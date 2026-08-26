import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import express from 'express';
import leaveRouter from '../routes/leave';
import { testPrisma as prisma, signTestToken } from './helpers/tenantTest';

const app = express();
app.use(express.json());
app.use('/api/leave', leaveRouter);

describe('Leave API permissions', () => {
  let employeeId: number;
  let secondEmployeeId: number;
  let officeAssistantToken: string;
  let employeeToken: string;
  let linkedDirectorToken: string;

  beforeAll(async () => {
    await prisma.leaveRequest.deleteMany({});
    await prisma.timesheet.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.sponsorship.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: '@leave-permissions.test' } },
    });
    await prisma.employee.deleteMany({
      where: { email: { contains: '@leave-permissions.test' } },
    });

    const employee = await prisma.employee.create({
      data: {
        firstName: 'Leave',
        lastName: 'Employee',
        email: 'employee@leave-permissions.test',
        jobTitle: 'Tester',
        employeeType: 'EMPLOYEE',
      },
    });
    employeeId = employee.id;

    const secondEmployee = await prisma.employee.create({
      data: {
        firstName: 'Other',
        lastName: 'Employee',
        email: 'other@leave-permissions.test',
        jobTitle: 'Tester',
        employeeType: 'EMPLOYEE',
      },
    });
    secondEmployeeId = secondEmployee.id;

    officeAssistantToken = `Bearer ${signTestToken({ email: 'office@leave-permissions.test', role: 'OFFICE_ASSISTANT' })}`;
    employeeToken = `Bearer ${signTestToken({ email: employee.email, role: 'EMPLOYEE', employeeId })}`;
    linkedDirectorToken = `Bearer ${signTestToken({
        email: 'director@leave-permissions.test',
        role: 'DIRECTOR',
        employeeId,
      })}`;
  });

  afterAll(async () => {
    await prisma.leaveRequest.deleteMany({
      where: { employeeId: { in: [employeeId, secondEmployeeId] } },
    });
    await prisma.employee.deleteMany({
      where: { id: { in: [employeeId, secondEmployeeId] } },
    });
    await prisma.$disconnect();
  });

  it('allows office assistants to approve pending leave requests', async () => {
    const leave = await prisma.leaveRequest.create({
      data: {
        employeeId,
        type: 'ANNUAL',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-03'),
        status: 'PENDING',
        reason: 'Office assistant approval',
      },
    });

    const response = await request(app)
      .put(`/api/leave/${leave.id}/approve`)
      .set('Authorization', officeAssistantToken);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('APPROVED');
  });

  it('keeps employee leave lists scoped to their own records', async () => {
    await prisma.leaveRequest.create({
      data: {
        employeeId,
        type: 'ANNUAL',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-02'),
        reason: 'Own leave',
      },
    });
    await prisma.leaveRequest.create({
      data: {
        employeeId: secondEmployeeId,
        type: 'SICK',
        startDate: new Date('2026-07-03'),
        endDate: new Date('2026-07-04'),
        reason: 'Other leave',
      },
    });

    const response = await request(app)
      .get('/api/leave')
      .set('Authorization', employeeToken);

    expect(response.status).toBe(200);
    expect(
      response.body.every((leave: any) => leave.employeeId === employeeId),
    ).toBe(true);
  });

  it('allows linked directors to request leave for their own employee profile without choosing an employee', async () => {
    const response = await request(app)
      .post('/api/leave')
      .set('Authorization', linkedDirectorToken)
      .send({
        type: 'ANNUAL',
        startDate: '2026-08-01',
        endDate: '2026-08-02',
        reason: 'Director self-service leave',
      });

    expect(response.status).toBe(200);
    expect(response.body.employeeId).toBe(employeeId);
  });

  it('rejects leave requests where the end date is before the start date', async () => {
    const response = await request(app)
      .post('/api/leave')
      .set('Authorization', employeeToken)
      .send({
        type: 'ANNUAL',
        startDate: '2026-09-10',
        endDate: '2026-09-05',
        reason: 'Invalid date range',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('End date cannot be before start date');
  });
});

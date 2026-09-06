import React from 'react';
import { Avatar } from '../ui';
import { fullName, useEmployeePhoto, type Employee } from './model';

// The design-system avatar with the employee's photo when one is on file.
export default function EmployeeAvatar({
  employee,
  size = 28,
}: {
  employee: Employee;
  size?: 28 | 40;
}) {
  const photo = useEmployeePhoto(employee);
  return <Avatar name={fullName(employee)} src={photo} size={size} />;
}

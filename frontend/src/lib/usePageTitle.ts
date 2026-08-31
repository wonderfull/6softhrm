import { useEffect } from 'react';

/**
 * Sets document.title for the current route. The default suffix is
 * "· OnsideHR" which keeps browser tabs and screen-reader announcements
 * disambiguated (test report B13: every page used to read "HRM Starter").
 */
export default function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · OnsideHR` : 'OnsideHR';
    return () => {
      document.title = previous;
    };
  }, [title]);
}

import { Outlet } from 'react-router';
import { useDocumentTitle } from '@/pages/helpers/pageHelpers';

export default function DesignSystemLayout() {
  useDocumentTitle('Design system — supdance');
  return <Outlet />;
}

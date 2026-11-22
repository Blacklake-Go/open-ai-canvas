import { Outlet } from 'react-router';
import { useDocumentTitle } from '@/pages/helpers/pageHelpers';

export default function AgentsLayout() {
  useDocumentTitle('Agent Chat — SupDance');
  return (
    <div className="h-screen w-full overflow-hidden bg-black">
      <Outlet />
    </div>
  );
}

import type {ReactNode} from 'react';
import WorkspaceAccessGate from '@/components/workspace-access-gate';
export default function AdminLayout({children}:{children:ReactNode}){
 return <WorkspaceAccessGate role="admin">{children}</WorkspaceAccessGate>;
}

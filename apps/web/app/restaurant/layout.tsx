import type {ReactNode} from 'react';
import WorkspaceAccessGate from '@/components/workspace-access-gate';
export default function MerchantLayout({children}:{children:ReactNode}){
 return <WorkspaceAccessGate role="merchant">{children}</WorkspaceAccessGate>;
}

'use client';

import PermissionManager from '../../../components/ui/PermissionManager';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';

export default function BranchAdminPermissionsPage() {
  return (
    <PageTransition>
      <div className="p-4 md:p-8 space-y-8">
        <SlideIn delay={0.1}>
          <PermissionManager />
        </SlideIn>
      </div>
    </PageTransition>
  );
}

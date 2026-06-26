'use client';

import PermissionManager from '../../../components/ui/PermissionManager';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';

export default function AdminPermissionsPage() {
  return (
    <PageTransition>
      <div className="p-4 md:p-6 space-y-6">
        <SlideIn delay={0.1}>
          <PermissionManager />
        </SlideIn>
      </div>
    </PageTransition>
  );
}

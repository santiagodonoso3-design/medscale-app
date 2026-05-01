import { AdminLayout } from '@/components/admin/layout'

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminLayout>{children}</AdminLayout>
}

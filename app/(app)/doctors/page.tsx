import { Suspense } from 'react'
import { DoctorsPageClient } from '@/components/doctors/doctors-page-client'

export default function DoctorsPage() {
  return (
    <Suspense>
      <DoctorsPageClient />
    </Suspense>
  )
}

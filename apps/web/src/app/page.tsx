import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import HeroSection from '@/components/landing/HeroSection';

export default async function HomePage() {
  const session = await getServerSession();
  if (session) redirect('/dashboard-geral');

  return <HeroSection />;
}

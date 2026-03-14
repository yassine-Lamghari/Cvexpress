import { NextResponse } from 'next/server';
import { JobOffer } from '@/types/cv';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  // Mock data simulation based on the query
  const mockJobs: JobOffer[] = Array.from({ length: 10 }).map((_, index) => ({
    id: `job-${index}`,
    title: `${query} (Niveau ${['Junior', 'Confirmé', 'Senior'][index % 3]})`,
    company: `Entreprise ${String.fromCharCode(65 + index)}`,
    location: ['Paris', 'Lyon', 'Télétravail', 'Bordeaux'][index % 4],
    description: `Nous recherchons un(e) ${query} talentueux(se) pour rejoindre notre équipe. \n\nMissions principales :\n- Développer de nouvelles fonctionnalités.\n- Participer aux revues de code et aux choix d'architecture.\n- Collaborer avec l'équipe design et produit.\n\nProfil recherché :\n- Expérience avérée sur un poste similaire.\n- Esprit d'équipe et bonne communication.\n- Autonomie et rigueur.\n\nAvantages :\n- Mutuelle d'entreprise.\n- Tickets restaurant.\n- Télétravail possible.`,
  }));

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  return NextResponse.json(mockJobs);
}

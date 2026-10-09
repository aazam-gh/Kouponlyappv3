type OpportunityKind =
  | 'event'
  | 'career'
  | 'learning'
  | 'experience'
  | 'entrepreneurship';

export type Opportunity = {
  id: string;
  kind: OpportunityKind;
  titleEn: string;
  summaryEn?: string;
  descriptionEn?: string;
  providerName?: string;
  imageUrl?: string;
  locationEn?: string;
  locationMode?: 'onsite' | 'remote' | 'hybrid';
  startsAt?: unknown;
  endsAt?: unknown;
  deadline?: unknown;
  featured?: boolean;
  status: 'draft' | 'published' | 'archived';
  publishedAt?: unknown;
  expiresAt?: unknown;
};

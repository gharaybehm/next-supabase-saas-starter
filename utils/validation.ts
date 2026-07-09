import { z } from 'zod';

export const PROPERTY_TYPES = [
  'apartment','villa','townhouse','office','retail',
  'warehouse','land','penthouse','duplex','other',
] as const;

export const STATUSES = ['active','pending','sold','rented','expired'] as const;

export const TRANSACTION_TYPES = ['sale', 'rent'] as const;

export const listingSchema = z.object({
  area: z.string().min(1),
  sub_community: z.string().optional(),
  transaction_type: z.enum(TRANSACTION_TYPES),
  property_type: z.enum(PROPERTY_TYPES),
  price_aed: z.coerce.number().int().positive(),
  size_sqft: z.coerce.number().positive(),
  bedrooms: z.coerce.number().int().min(0),
  bathrooms: z.coerce.number().int().min(0),
  description_en: z.string().optional(),
  description_ar: z.string().optional(),
  dld_permit_no: z.string().min(1),
  virtual_tour_url: z.string().url().optional().or(z.literal('')),
  status: z.enum(STATUSES).default('active'),
});

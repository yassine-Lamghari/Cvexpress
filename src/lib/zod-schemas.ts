import { z } from 'zod';

export const personalInfoSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Email Invalide'),
  phone: z.string().min(6, 'Numéro invalide'),
  city: z.string().min(1, 'La ville est requise'),
  country: z.string().min(1, 'Le pays est requis'),
  linkedin: z.string().url('URL Invalide').optional().or(z.literal('')),
  website: z.string().url('URL Invalide').optional().or(z.literal('')),
  title: z.string().optional(),
  photo: z.string().optional(),
});

export const experienceSchema = z.object({
  id: z.string(),
  jobTitle: z.string().min(1, 'Requis'),
  company: z.string().min(1, 'Requis'),
  location: z.string().optional(),
  startDate: z.string().min(1, 'Requise'),
  endDate: z.string().min(1, 'Requise'),
  description: z.string(),
});

export const educationSchema = z.object({
  id: z.string(),
  degree: z.string().min(1, 'Requis'),
  school: z.string().min(1, 'Requis'),
  location: z.string().optional(),
  startDate: z.string().min(1, 'Requise'),
  endDate: z.string().min(1, 'Requise'),
  description: z.string().optional(),
});

export const skillSchema = z.object({
  name: z.string().min(1, 'Requis'),
  level: z.enum(['débutant', 'intermédiaire', 'avancé', 'expert', 'beginner', 'intermediate', 'advanced', 'expert']).optional(),
});

export const cvSchema = z.object({
  personalInfo: personalInfoSchema,
  summary: z.string().optional(),
  experiences: z.array(experienceSchema),
  stages: z.array(experienceSchema),
  education: z.array(educationSchema),
  skills: z.array(skillSchema),
  languages: z.array(z.object({ name: z.string(), level: z.string() })),
  certifications: z.array(z.object({ name: z.string(), issuer: z.string() })),
});

export const sendApplicationSchema = z.object({
  recipientEmails: z.array(z.string().email('Email Invalide')).min(1, 'Au moins un email est requis'),
  recipientName: z.string().max(120).optional(),
  companyName: z.string().max(120).optional(),
  subject: z
    .string()
    .min(3, 'Subject is too short')
    .max(180, 'Subject is too long')
    .refine((value) => !/[\r\n]/.test(value), 'Subject contains invalid characters'),
  emailBody: z.string().min(20, 'Email is too short').max(8000, 'Email is too long'),
  candidateEmail: z.string().email('Invalid candidate email'),
  candidateFullName: z.string().min(2).max(120),
  template: z.string().min(2).max(60),
  latexCode: z.string().min(20, 'Missing LaTeX code'),
  photo: z.string().optional(),
  motivationLetter: z.string().min(20, 'Motivation letter is too short').max(12000),
  includeCvPdf: z.boolean().default(true),
  includeLetterPdf: z.boolean().default(true),
});

export type CVDataInput = z.infer<typeof cvSchema>;
export type SendApplicationInput = z.infer<typeof sendApplicationSchema>;

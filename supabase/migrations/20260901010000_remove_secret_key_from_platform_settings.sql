-- Migration: Remove paystack_secret_key column from platform_settings table to secure secret keys inside backend secrets

ALTER TABLE public.platform_settings DROP COLUMN IF EXISTS paystack_secret_key;

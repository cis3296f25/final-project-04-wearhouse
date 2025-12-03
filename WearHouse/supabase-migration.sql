-- Migration: Create outfits table for storing saved outfits/closet
-- Run this in your Supabase SQL Editor
-- Updated to work with the user authentication system

-- Create outfits table with user_id for per-user outfits
CREATE TABLE IF NOT EXISTS outfits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Untitled Outfit',
  top_id UUID REFERENCES items(id) ON DELETE SET NULL,
  bottom_id UUID REFERENCES items(id) ON DELETE SET NULL,
  shoes_id UUID REFERENCES items(id) ON DELETE SET NULL,
  outerwear_id UUID REFERENCES items(id) ON DELETE SET NULL,
  weather_temp INTEGER,
  weather_condition TEXT,
  event_title TEXT,
  event_formality TEXT,
  category TEXT DEFAULT 'casual',
  is_favorite BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_outfits_user_id ON outfits(user_id);
CREATE INDEX IF NOT EXISTS idx_outfits_created_at ON outfits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outfits_category ON outfits(category);
CREATE INDEX IF NOT EXISTS idx_outfits_is_favorite ON outfits(is_favorite);

-- Enable Row Level Security (RLS)
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;

-- RLS policies for outfits
CREATE POLICY "Enable all operations for outfits" ON outfits
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_outfits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_outfits_timestamp
  BEFORE UPDATE ON outfits
  FOR EACH ROW
  EXECUTE FUNCTION update_outfits_updated_at();

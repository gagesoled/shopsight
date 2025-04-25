# SoledSearch Market Analysis

A platform for analyzing market opportunities and customer behavior at different levels of market research.

## Features

- **Project-Based Storage**: Create projects and associate file uploads with specific projects
- **Category Search**: Identify niche market opportunities through category level data analysis
- **Niche Explorer**: Deep dive into specific niches with detailed behavioral analysis
- **Product Keywords**: Product-level keyword optimization and performance analysis

## Setup Instructions

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- A Supabase account (free tier is sufficient)

### Supabase Setup

1. Create a new Supabase project at [https://supabase.com](https://supabase.com)
2. In your Supabase project, run the following SQL to create the required tables:

```sql
-- Create projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create files table
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level >= 1 AND level <= 3),
  original_filename TEXT NOT NULL,
  parsed_json JSONB NOT NULL,
  parser_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optional index for faster queries
CREATE INDEX files_project_id_idx ON files(project_id);
CREATE INDEX files_level_idx ON files(level);
```

3. In your Supabase project dashboard, go to **Project Settings** > **API** and copy the following:
   - **Project URL**
   - **Project API Keys** > **anon public** (for browser use)
   - **Project API Keys** > **service_role** (secret, for server API routes)

### Environment Variables

Create a `.env.local` file in the project root with the following variables:

```
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_public_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Replace the placeholder values with your actual Supabase credentials.

⚠️ **IMPORTANT**: Never commit the `.env.local` file to version control, especially since it contains your secret service role key. The file is already included in `.gitignore`.

### Installation

```bash
# Install dependencies
npm install
# or
yarn install

# Start the development server
npm run dev
# or
yarn dev
```

## Usage

1. Open the application in your browser (default: http://localhost:3000)
2. Create a new project on the Home page
3. Navigate to the desired analysis tool (Category Search, Niche Explorer, or Product Keywords)
4. Upload your data files for analysis
5. Explore the analysis results and insights

## File Upload Levels

- **Level 1**: Category-level data (used in Category Search)
- **Level 2**: Niche-specific data with search terms, insights, and products (used in Niche Explorer)
- **Level 3**: Product-level keyword data (used in Product Keywords) 
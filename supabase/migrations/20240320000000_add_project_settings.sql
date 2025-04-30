-- Add settings column to projects table
ALTER TABLE projects
ADD COLUMN settings JSONB DEFAULT '{
  "maxClusters": 6,
  "minClusterSize": 3,
  "clusteringSettings": {
    "searchTerms": {
      "enabled": true,
      "parameters": {
        "minClusterSize": 3,
        "maxClusters": 6,
        "similarityThreshold": 0.7
      }
    },
    "products": {
      "enabled": true,
      "parameters": {
        "minClusterSize": 3,
        "maxClusters": 6,
        "similarityThreshold": 0.7
      }
    }
  }
}'::jsonb;

-- Create analysis_results table
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on project_id for faster lookups
CREATE INDEX idx_analysis_results_project_id ON analysis_results(project_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_analysis_results_updated_at
  BEFORE UPDATE ON analysis_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 
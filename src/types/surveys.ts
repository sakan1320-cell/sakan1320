export type SurveyFieldType = 
  | "short_answer" 
  | "paragraph" 
  | "radio" 
  | "checkboxes" 
  | "dropdown" 
  | "linear_scale" 
  | "star_rating" 
  | "grid_matrix" 
  | "checkbox_grid";

export interface SurveyField {
  id: string;
  type: SurveyFieldType;
  label: string;
  description?: string;
  required: boolean;
  options?: string[]; // for radio, dropdown, checkboxes
  scale_min?: number; // for linear scale
  scale_max?: number;
  scale_min_label?: string;
  scale_max_label?: string;
  grid_rows?: string[]; // for grids
  grid_cols?: string[]; // for grids
}

export interface ProjectSurvey {
  id: string;
  project_id: string | null;
  title_ar: string;
  title_en: string | null;
  description: string | null;
  is_template: boolean;
  fields: SurveyField[];
  created_at: string;
  created_by: string;
  is_published?: boolean;
  target_audience?: "team" | "participants";
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  user_id: string;
  answers: Record<string, any>;
  submitted_at: string;
}

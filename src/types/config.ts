export interface ProjectConfig {
  path: string;
  dockerImage: string;
}

export interface SystemConfig {
  projects: ProjectConfig[];
  debug?: boolean;
}
export interface ProjectConfig {
  path: string;
  dockerImage?: string;
  containerName?: string;
}

export interface SystemConfig {
  projects: ProjectConfig[];
  debug?: boolean;
}

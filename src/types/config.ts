// src/types/config.ts
export interface ProjectConfig {
  name: string;
  hostPath: string;
  containerPath?: string;
  dockerImage?: string;
  containerName?: string;
}

export interface SystemConfig {
  projects: ProjectConfig[];
  debug?: boolean;
}
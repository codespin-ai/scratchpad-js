// src/config/types.ts
export interface ProjectConfig {
  name: string;
  hostPath: string;
  containerPath?: string;
  dockerImage?: string;
  containerName?: string;
  network?: string;
}

export interface SystemConfig {
  projects: ProjectConfig[];
  debug?: boolean;
}
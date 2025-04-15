// src/utils/logger.ts
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

// Create the necessary directory structure
function ensureLogDirectories() {
  const logDir = path.join(os.homedir(), '.codespin', 'logs');
  const requestsDir = path.join(logDir, 'requests');
  
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  if (!fs.existsSync(requestsDir)) {
    fs.mkdirSync(requestsDir, { recursive: true });
  }
  
  return { logDir, requestsDir };
}

// Get current timestamp formatted as YYYY-MM-DD_HH-MM-SS
function getFormattedTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

// Get date part for file naming (YYYY-MM-DD)
function getDatePart() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// Check if debug mode is enabled in config
export function isDebugEnabled(): boolean {
  const configPath = path.join(os.homedir(), '.codespin', 'codebox.json');
  
  if (!fs.existsSync(configPath)) {
    return false;
  }
  
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);
    return !!config.debug;
  } catch (error) {
    console.error('Failed to parse config file:', error);
    return false;
  }
}

// Log MCP method execution
export function logMcpCall({
  method,
  payload,
  response,
  startTime,
  endTime
}: {
  method: string;
  payload: any;
  response: any;
  startTime: Date;
  endTime: Date;
}) {
  if (!isDebugEnabled()) {
    return;
  }
  
  try {
    const { logDir, requestsDir } = ensureLogDirectories();
    const requestId = uuidv4();
    const timestamp = getFormattedTimestamp();
    const datePart = getDatePart();
    const processingTime = endTime.getTime() - startTime.getTime();
    
    // Log main entry in the daily log file
    const logFile = path.join(logDir, `${datePart}.log`);
    const logEntry = `[${timestamp}] ${requestId} | Method: ${method} | Payload size: ${JSON.stringify(payload).length} bytes | Processing time: ${processingTime}ms\n`;
    
    fs.appendFileSync(logFile, logEntry);
    
    // Save payload and response to separate files
    const payloadFile = path.join(requestsDir, `${datePart}_${requestId}_payload.json`);
    const responseFile = path.join(requestsDir, `${datePart}_${requestId}_response.json`);
    
    fs.writeFileSync(payloadFile, JSON.stringify(payload, null, 2));
    fs.writeFileSync(responseFile, JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('Error logging MCP call:', error);
  }
}
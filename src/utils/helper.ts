import { Data } from "../models/Data";

  
   export const generateUniqueSlNo = async (): Promise<string> => {
    let attempts = 0;
    const maxAttempts = 15;
    
    while (attempts < maxAttempts) {

      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const counter = attempts.toString().padStart(2, '0');
      const candidateSlNo = `REG${timestamp}${randomSuffix}${counter}`;
      
 
      const existingSlNo = await Data.findOne({ slNo: candidateSlNo });
      if (!existingSlNo) {
        return candidateSlNo;
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    const now = new Date();
    const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    const timeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
    const fallbackSlNo = `REG${dateStr}${timeStr}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}${Math.random().toString(36).substring(2, 4).toUpperCase()}`;
    return fallbackSlNo;
  };


  export const generateUniqueProfileId = async (): Promise<string> => {
    let attempts = 0;
    const maxAttempts = 15;
    
    while (attempts < maxAttempts) {
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const counter = attempts.toString().padStart(2, '0');
      const candidateProfileId = `PRO${timestamp}${randomSuffix}${counter}`;
      
      const existingProfileId = await Data.findOne({ profileId: candidateProfileId });
      if (!existingProfileId) {
        return candidateProfileId;
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    const now = new Date();
    const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    const timeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
    const fallbackProfileId = `PRO${dateStr}${timeStr}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}${Math.random().toString(36).substring(2, 4).toUpperCase()}`;
    return fallbackProfileId;
  };

import{adminAuthenticate,publishedContent,response,failure}from'@/lib/server-store';
import{coverageReport}from'@/lib/coverage-report';
import{programVersion}from'@/lib/content';
export async function GET(){try{await adminAuthenticate();const {topics,tasks}=await publishedContent();return response({...coverageReport(topics,tasks),programVersion});}catch(e){return failure(e);}}

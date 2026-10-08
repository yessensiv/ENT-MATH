import {editorAuthenticate,response,failure,ApiError} from '@/lib/server-store';
import index from '@/content/source-library/index.json';
import {sourceLibraryLoaders} from '@/lib/source-library-loaders';
import {querySourceLibrary,type SourceIndex} from '@/lib/source-library';
export async function GET(request:Request){
 try{
  await editorAuthenticate();
  const params=new URL(request.url).searchParams,id=params.get('id');
  if(!id)return response(querySourceLibrary(index as SourceIndex,params));
  if(!/^[a-f0-9]{20}$/.test(id)||!Object.hasOwn(sourceLibraryLoaders,id))throw new ApiError('Раздел не найден.',404);
  return response({material:(await sourceLibraryLoaders[id]()).default});
 }catch(error){return failure(error);}
}

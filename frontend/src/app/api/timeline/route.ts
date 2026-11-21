import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission } from '@/lib/server/permissions';
import { ApiError,toErrorResponse } from '@/lib/server/errors';
import { parsePagination } from '@/lib/server/pagination';

export async function GET(request:Request){try{await requireAuthenticatedUser();const u=new URL(request.url),f=u.searchParams.get('family_id');if(!f||!z.string().uuid().safeParse(f).success)throw new ApiError(400,'INVALID_FAMILY_ID','A valid family_id is required.');await requireFamilyPermission(f,'view_family');const {page,pageSize}=parsePagination(u.searchParams),s=await createClient();const {data,error,count}=await s.from('timeline_events').select('id,family_id,care_recipient_id,event_type,title,description,occurred_at,created_by,created_at',{count:'exact'}).eq('family_id',f).order('occurred_at',{ascending:false}).range((page-1)*pageSize,page*pageSize-1);if(error)throw new ApiError(500,'TIMELINE_FETCH_FAILED','Unable to load timeline.');return Response.json({data:{items:data??[],page,pageSize,total:count??0,totalPages:Math.ceil((count??0)/pageSize)}});}catch(e){return toErrorResponse(e);}}

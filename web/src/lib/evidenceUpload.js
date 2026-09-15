import { supabase } from './supabaseClient.ts'

const MAX_FILE_BYTES = 15 * 1024 * 1024 // 15MB
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
])

export function validateEvidenceFile(file) {
  if (!ALLOWED_TYPES.has(file.type)) {
    return `File type "${file.type || 'unknown'}" is not allowed. Use PDF, JPG, PNG, WEBP, or HEIC.`
  }
  if (file.size > MAX_FILE_BYTES) {
    return `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max is 15MB.`
  }
  return null
}

/**
 * Uploads a case evidence file to the private 'case-evidence' Storage
 * bucket and records its metadata. The file itself is never public by
 * default — see case_evidence RLS in supabase/migrations/0004.
 */
export async function uploadCaseEvidence({ caseId, file, kind, userId }) {
  const validationError = validateEvidenceFile(file)
  if (validationError) throw new Error(validationError)

  const path = `${caseId}/${crypto.randomUUID()}-${file.name}`

  const { error: uploadError } = await supabase.storage.from('case-evidence').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data, error: insertError } = await supabase
    .from('case_evidence')
    .insert({
      case_id: caseId,
      kind,
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
      content_type: file.type,
      uploaded_by: userId,
    })
    .select()
    .single()

  if (insertError) throw insertError
  return data
}

export async function getEvidenceSignedUrl(storagePath) {
  const { data, error } = await supabase.storage.from('case-evidence').createSignedUrl(storagePath, 60 * 10)
  if (error) throw error
  return data.signedUrl
}

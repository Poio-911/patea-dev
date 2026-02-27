/**
 * Server action para subir logos de competiciones
 */
'use server';

import { getAdminStorage } from '@/firebase/admin-init';

export async function uploadCompetitionLogoAction(
    file: Buffer,
    fileName: string,
    competitionType: 'league' | 'cup',
    groupId: string,
    userId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
        // ✅ VALIDATION: Ensure userId is provided
        if (!userId) return { success: false, error: 'No autorizado' };

        // Validar tamaño (5MB max)
        const sizeInMB = file.length / (1024 * 1024);
        if (sizeInMB > 5) {
            return { success: false, error: 'La imagen no debe superar los 5MB.' };
        }

        // Obtener bucket de Storage
        const bucket = getAdminStorage();

        // Crear path del archivo incluyendo el userId para cumplir con Storage Rules
        const filePath = `${competitionType}s/${groupId}/${userId}/${Date.now()}_${fileName}`;
        const fileRef = bucket.file(filePath);

        // Subir archivo
        await fileRef.save(file, {
            metadata: {
                contentType: 'image/png', // o detectar el tipo real
            },
        });

        // Hacer el archivo público
        await fileRef.makePublic();

        // Obtener URL pública
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

        return { success: true, url: publicUrl };
    } catch (error: any) {
        console.error('Error uploading competition logo:', error);
        return { success: false, error: error.message || 'Error al subir la imagen' };
    }
}

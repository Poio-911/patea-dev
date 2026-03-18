
'use client';

import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogTrigger as DialogTrigger,
} from '@/components/ui/responsive-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Camera, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { PlayerPosition } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { publishActivityAction } from '@/lib/actions/social-actions';
import { Slider } from '@/components/ui/slider';
import { getOvrColorClass } from '@/lib/player-utils';
import { ImageCropperDialog } from './image-cropper-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { createManualPlayerAction } from '@/lib/actions/player-actions';

const playerSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  position: z.enum(['DEL', 'MED', 'DEF', 'POR'], { required_error: 'La posición es obligatoria.' }),
  pac: z.number().min(1).max(99),
  sho: z.number().min(1).max(99),
  pas: z.number().min(1).max(99),
  dri: z.number().min(1).max(99),
  def: z.number().min(1).max(99),
  phy: z.number().min(1).max(99),
});

type PlayerFormData = z.infer<typeof playerSchema>;

const AttributeSlider = ({ label, attributeKey, control }: { label: string, attributeKey: keyof PlayerFormData, control: any }) => (
  <Controller
    name={attributeKey}
    control={control}
    render={({ field }) => {
      const colorClass = getOvrColorClass(field.value);
      return (
        <div className="space-y-3 p-3 rounded-xl bg-muted/30 border border-border/50">
          <div className="flex justify-between items-center px-1">
            <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</Label>
            <span className={cn("text-lg font-black font-headline tabular-nums", colorClass)}>
              {field.value}
            </span>
          </div>
          <Slider
            value={[field.value]}
            min={1}
            max={99}
            step={1}
            onValueChange={(val) => field.onChange(val[0])}
            className="touch-none"
          />
        </div>
      );
    }}
  />
);


export function AddPlayerDialog() {
  const [open, setOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useUser();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<PlayerFormData>({
    resolver: zodResolver(playerSchema),
    defaultValues: {
      name: '',
      pac: 60,
      sho: 60,
      pas: 60,
      dri: 60,
      def: 60,
      phy: 60,
    },
  });

  const onSubmit = async (data: PlayerFormData) => {
    if (!user || !user.activeGroupId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Tenés que seleccionar un grupo activo para añadir un jugador.',
      });
      return;
    }

    setIsSaving(true);

    const ovr = Math.round(
      (data.pac + data.sho + data.pas + data.dri + data.def + data.phy) / 6
    );

    try {
      const result = await createManualPlayerAction({
        ...data,
        ovr,
        groupId: user.activeGroupId,
        photoUrl: photoUrl || `https://picsum.photos/seed/${data.name || Date.now()}/400/400`,
      }, user.uid);

      if (!result.success) {
        throw new Error(result.message);
      }


      toast({ title: '¡Jugador Agregado!', description: 'El jugador se sumó al plantel con éxito.' });
      setOpen(false);
      reset();
      setPhotoUrl(null);
    } catch (error) {
      console.error('Error al añadir jugador:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo añadir el jugador.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-headline font-bold">
          <PlusCircle className="mr-2 h-4 w-4" />
          Agregar Jugador
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl p-0 overflow-hidden border-0 shadow-2xl rounded-3xl">
        {!user?.activeGroupId ? (
          <div className="p-6">
            <Alert variant="destructive">
              <AlertTitle>No hay grupo activo</AlertTitle>
              <AlertDescription>
                Por favor, seleccioná o creá un grupo antes de agregar un jugador.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col max-h-[90vh]">
            <div className="p-6 border-b bg-background/50 backdrop-blur-md sticky top-0 z-10">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black font-headline tracking-tight">Agregar Jugador Manual</DialogTitle>
                <DialogDescription className="font-medium">
                  Personalizá los stats y la foto del nuevo fichaje.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="p-6 overflow-y-auto space-y-8 pb-24">
              {/* Top Section: Photo & Basic Info */}
              <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                <div className="flex flex-col items-center gap-3 shrink-0">
                  <div className="relative group">
                    <Avatar className="h-32 w-32 border-4 border-muted/50 shadow-xl overflow-hidden bg-muted group-hover:border-primary/50 transition-all duration-300">
                      <AvatarImage src={photoUrl || undefined} className="object-cover" />
                      <AvatarFallback className="text-4xl font-black opacity-20">
                        {photoUrl ? '' : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <ImageCropperDialog
                      player={{ photoURL: photoUrl || undefined }}
                      onSaveComplete={(url) => setPhotoUrl(url)}
                      skipProfileUpdate={true}
                    >
                      <button
                        type="button"
                        className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full shadow-lg hover:scale-110 transition-transform flex items-center justify-center border-2 border-background"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                    </ImageCropperDialog>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Foto del Jugador</span>
                </div>

                <div className="flex-1 space-y-6 w-full">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">
                      Nombre Completo
                    </Label>
                    <Input
                      id="name"
                      placeholder="Ej: Oliver Atom"
                      {...register('name')}
                      className="h-12 text-lg font-bold bg-muted/20 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl"
                    />
                    {errors.name && <p className="text-xs font-bold text-destructive mt-1 ml-1">{errors.name.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="position" className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">
                      Posición
                    </Label>
                    <Controller
                      name="position"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger className="h-12 bg-muted/20 border-border/50 rounded-xl font-bold">
                            <SelectValue placeholder="Seleccioná una posición" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border/50">
                            <SelectItem value="DEL" className="font-bold">DEL (Delantero)</SelectItem>
                            <SelectItem value="MED" className="font-bold">MED (Volante)</SelectItem>
                            <SelectItem value="DEF" className="font-bold">DEF (Defensa)</SelectItem>
                            <SelectItem value="POR" className="font-bold">POR (Arquero)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.position && <p className="text-xs font-bold text-destructive mt-1 ml-1">{errors.position.message}</p>}
                  </div>
                </div>
              </div>

              {/* Attributes Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-px flex-1 bg-border/50" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Atributos Base</span>
                  <div className="h-px flex-1 bg-border/50" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AttributeSlider label="Ritmo (RIT)" attributeKey="pac" control={control} />
                  <AttributeSlider label="Tiro (TIR)" attributeKey="sho" control={control} />
                  <AttributeSlider label="Pase (PAS)" attributeKey="pas" control={control} />
                  <AttributeSlider label="Regate (REG)" attributeKey="dri" control={control} />
                  <AttributeSlider label="Defensa (DEF)" attributeKey="def" control={control} />
                  <AttributeSlider label="Físico (FIS)" attributeKey="phy" control={control} />
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-background/80 backdrop-blur-md absolute bottom-0 left-0 right-0 z-20">
              <Button
                type="submit"
                className="w-full h-14 text-lg font-black font-headline uppercase tracking-wide gap-2 rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Crear Nuevo Fichaje'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

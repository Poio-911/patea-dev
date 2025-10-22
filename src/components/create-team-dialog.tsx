
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, PlusCircle, Shield, ArrowRight, ArrowLeft } from 'lucide-react';
import { Player, GroupTeam, JerseyStyle } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';

const formations = ['4-4-2', '4-3-3', '3-5-2', '5-3-2', '4-5-1'];
const jerseyStyles: JerseyStyle[] = ['solid', 'stripes', 'sash'];
const colorPalette = ['#d32f2f', '#303f9f', '#0288d1', '#388e3c', '#fbc02d', '#f57c00', '#000000', '#ffffff'];

// Step 1: Basic Info
const step1Schema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
});

// Step 2: Jersey Design
const step2Schema = z.object({
  jersey: z.object({
    style: z.enum(jerseyStyles),
    primaryColor: z.string(),
    secondaryColor: z.string(),
  }),
});

// Step 3: Formation
const step3Schema = z.object({
  formation: z.string().min(1, "Debes seleccionar una formación."),
});

// Step 4: Members
const step4Schema = z.object({
  members: z.array(z.object({
    playerId: z.string(),
    number: z.coerce.number().min(1, "El dorsal es obligatorio.").max(99, "El dorsal no puede ser mayor a 99."),
  })).min(1, 'Debes seleccionar al menos un miembro.'),
});

const createTeamSchema = step1Schema.merge(step2Schema).merge(step3Schema).merge(step4Schema);
type CreateTeamFormData = z.infer<typeof createTeamSchema>;

const JerseyIcon = ({ primaryColor, secondaryColor, style }: { primaryColor: string, secondaryColor: string, style: JerseyStyle }) => (
  <svg viewBox="0 0 486.347 486.347" className="w-full h-full">
    <defs>
      <pattern id="stripes" patternUnits="userSpaceOnUse" width="20" height="20">
        <path d="M0 0 H 20 V 20 H 0 Z" fill={primaryColor} />
        <path d="M0 0 H 10 V 20 H 0 Z" fill={secondaryColor} />
      </pattern>
      <linearGradient id="sash" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="45%" stopColor={primaryColor} />
        <stop offset="45%" stopColor={secondaryColor} />
        <stop offset="55%" stopColor={secondaryColor} />
        <stop offset="55%" stopColor={primaryColor} />
      </linearGradient>
    </defs>
    <g>
		<path d="M14.32,158.336c2.691,10.546,12.167,17.909,23.057,17.909c1.922,0,3.845-0.236,5.723-0.701l39.417-9.79
			c4.466-1.072,5.626,2.404,5.626,4.396v249.939c0,13.049,10.63,23.676,23.686,23.676H374.7c13.063,0,23.699-10.627,23.699-23.676
			V170.208c0-1.729,0.497-4.626,3.892-4.626c0.528,0,1.13,0.08,1.719,0.23l39.237,9.74c1.871,0.465,3.803,0.702,5.727,0.702
			c10.892,0,20.369-7.364,23.051-17.909l13.577-53.215c1.566-6.141,0.645-12.509-2.605-17.941
			c-3.241-5.422-8.411-9.253-14.559-10.778L343.975,45.511c-7.489-1.905-15.212-2.879-22.998-2.879l-30.453-0.05l-1.454,6.015
			c-5.154,21.454-24.149,36.434-46.196,36.434c-22.051,0-41.05-14.979-46.198-36.434l-1.453-6.015h-28.569l-1.403,0.058
			c-7.72,0-15.437,0.974-22.876,2.863L17.915,76.41c-6.155,1.525-11.319,5.356-14.569,10.778c-3.242,5.424-4.17,11.8-2.599,17.941
			L14.32,158.336z" fill={style === 'solid' ? primaryColor : style === 'stripes' ? 'url(#stripes)' : 'url(#sash)'} />
    </g>
  </svg>
);

const JerseyCreator = ({ control }: { control: any }) => {
    const jersey = useForm().watch();

    return (
        <Controller
            name="jersey"
            control={control}
            render={({ field }) => (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 items-center">
                        <div className="w-full h-32 rounded-md flex items-center justify-center p-2 bg-muted">
                           <div className="w-24 h-24">
                             <JerseyIcon {...field.value} />
                           </div>
                        </div>
                        <div className="space-y-3">
                           <div>
                            <Label>Estilo</Label>
                            <div className="flex gap-2 mt-1">
                                {jerseyStyles.map(style => (
                                    <Button key={style} type="button" variant={field.value.style === style ? 'default' : 'outline'} size="sm" onClick={() => field.onChange({ ...field.value, style })}>
                                        {style.charAt(0).toUpperCase() + style.slice(1)}
                                    </Button>
                                ))}
                            </div>
                           </div>
                        </div>
                    </div>
                    <div>
                        <Label>Colores</Label>
                        <div className="flex gap-2 mt-1">
                            {colorPalette.map(color => (
                                <button key={color} type="button" className="h-8 w-8 rounded-full border-2" style={{ backgroundColor: color, borderColor: field.value.primaryColor === color ? 'hsl(var(--ring))' : 'transparent' }} onClick={() => field.onChange({ ...field.value, primaryColor: color })} />
                            ))}
                        </div>
                        <div className="flex gap-2 mt-2">
                             {colorPalette.map(color => (
                                <button key={color} type="button" className="h-8 w-8 rounded-full border-2" style={{ backgroundColor: color, borderColor: field.value.secondaryColor === color ? 'hsl(var(--ring))' : 'transparent' }} onClick={() => field.onChange({ ...field.value, secondaryColor: color })} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        />
    );
};

const FormationSelector = ({ control }: { control: any }) => (
  <Controller
    name="formation"
    control={control}
    render={({ field }) => (
        <div className="space-y-3">
            <Label>Formación</Label>
             <div className="grid grid-cols-3 gap-2">
                {formations.map(formation => (
                    <Button key={formation} type="button" variant={field.value === formation ? 'default' : 'outline'} onClick={() => field.onChange(formation)}>
                        {formation}
                    </Button>
                ))}
            </div>
        </div>
    )}
  />
);

const MemberManager = ({ control, groupPlayers }: { control: any; groupPlayers: Player[] }) => {
  const { fields, append, remove, update } = useFieldArray({ control, name: "members" });
  const [searchTerm, setSearchTerm] = useState('');

  const selectedPlayerIds = new Set(fields.map(field => (field as any).playerId));

  const availablePlayers = useMemo(() => {
    return groupPlayers
      .filter(player => !selectedPlayerIds.has(player.id))
      .filter(player => player.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [groupPlayers, selectedPlayerIds, searchTerm]);

  return (
    <div className="space-y-4">
        <h4 className="font-semibold">Miembros del equipo ({fields.length})</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label>Jugadores Seleccionados</Label>
                <ScrollArea className="h-48 border rounded-md p-2">
                    {fields.length > 0 ? fields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-2 p-1">
                            <Input
                                type="number"
                                placeholder="#"
                                className="w-16 h-8"
                                {...control.register(`members.${index}.number`)}
                            />
                            <p className="flex-1 font-medium truncate">{(groupPlayers.find(p => p.id === (field as any).playerId))?.name}</p>
                            <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>X</Button>
                        </div>
                    )) : <p className="text-center text-sm text-muted-foreground p-4">Aún no hay jugadores.</p>}
                </ScrollArea>
            </div>
            <div className="space-y-2">
                 <Label>Jugadores Disponibles</Label>
                 <Input placeholder="Buscar para agregar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                <ScrollArea className="h-40 border rounded-md p-2">
                    {availablePlayers.map(player => (
                        <div key={player.id} className="flex items-center gap-2 p-1 hover:bg-accent rounded-md cursor-pointer" onClick={() => append({ playerId: player.id, number: 1 })}>
                           <Avatar className="h-8 w-8"><AvatarImage src={player.photoUrl} /><AvatarFallback>{player.name.charAt(0)}</AvatarFallback></Avatar>
                           <p className="flex-1 font-medium truncate">{player.name}</p>
                           <PlusCircle className="h-4 w-4 text-muted-foreground" />
                        </div>
                    ))}
                </ScrollArea>
            </div>
        </div>
    </div>
  );
};


export function CreateTeamDialog({ groupPlayers }: { groupPlayers: Player[] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateTeamFormData>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: {
      name: '',
      jersey: { style: 'solid', primaryColor: '#d32f2f', secondaryColor: '#ffffff' },
      formation: '4-4-2',
      members: [],
    },
  });

  const { control, trigger, getValues, handleSubmit } = form;

  const nextStep = async () => {
    let fieldsToValidate: (keyof CreateTeamFormData)[] = [];
    if (step === 1) fieldsToValidate = ['name'];
    if (step === 2) fieldsToValidate = ['jersey'];
    if (step === 3) fieldsToValidate = ['formation'];
    
    const isValid = await trigger(fieldsToValidate);
    if (isValid) setStep(s => s + 1);
  };
  const prevStep = () => setStep(s => s - 1);
  
  const onSubmit = async (data: CreateTeamFormData) => {
    if (!firestore || !user?.activeGroupId) {
        toast({ variant: 'destructive', title: 'Error', description: 'No hay un grupo activo.' });
        return;
    }
    setIsSubmitting(true);
    try {
        const newTeam: Omit<GroupTeam, 'id'> = {
            name: data.name,
            formation: data.formation,
            jersey: data.jersey,
            ownerUid: user.uid,
            groupId: user.activeGroupId,
            members: data.members,
        };
        await addDoc(collection(firestore, 'groups', user.activeGroupId, 'teams'), newTeam);
        toast({ title: '¡Equipo Creado!', description: `El equipo "${data.name}" se ha formado.` });
        setOpen(false);
        form.reset();
        setStep(1);
    } catch (error) {
        console.error('Error creating team:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear el equipo.' });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><PlusCircle className="mr-2 h-4 w-4" />Crear Equipo</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Asistente de Creación de Equipo</DialogTitle>
          <DialogDescription>Paso {step} de 4: {['Datos Básicos', 'Diseño de Camiseta', 'Táctica', 'Miembros'][step-1]}</DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className={step !== 1 ? 'hidden' : ''}>
                <Label htmlFor="team-name">Nombre del Equipo</Label>
                <Input id="team-name" {...form.register('name')} placeholder="Ej: Furia Roja" />
                {form.formState.errors.name && <p className="text-destructive text-xs mt-1">{form.formState.errors.name.message}</p>}
            </div>

            <div className={step !== 2 ? 'hidden' : ''}><JerseyCreator control={control} /></div>
            <div className={step !== 3 ? 'hidden' : ''}><FormationSelector control={control} /></div>
            <div className={step !== 4 ? 'hidden' : ''}><MemberManager control={control} groupPlayers={groupPlayers} /></div>

            <DialogFooter className="pt-4">
                {step > 1 && <Button type="button" variant="outline" onClick={prevStep}><ArrowLeft className="mr-2 h-4 w-4" />Anterior</Button>}
                {step < 4 && <Button type="button" onClick={nextStep}>Siguiente<ArrowRight className="ml-2 h-4 w-4" /></Button>}
                {step === 4 && <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}Crear Equipo</Button>}
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

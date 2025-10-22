
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, PlusCircle, Shield, ArrowRight, ArrowLeft } from 'lucide-react';
import { Player, GroupTeam, JerseyStyle, TeamMember } from '@/lib/types';
import { cn } from '@/lib/utils';
import { JerseyIcon } from './jerseys';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';


const formations = ['4-4-2', '4-3-3', '3-5-2', '5-3-2', '4-5-1'];
const jerseyStyles: { id: JerseyStyle, name: string }[] = [
    { id: 'solid', name: 'Liso' },
    { id: 'stripes', name: 'Rayas' },
    { id: 'sash', name: 'Banda' },
    { id: 'halves', name: 'Mitades' },
];
const colorPalette = [
    '#d32f2f', '#c2185b', '#7b1fa2', '#512da8', '#303f9f', '#1976d2',
    '#0288d1', '#0097a7', '#00796b', '#388e3c', '#689f38', '#fbc02d',
    '#ffa000', '#f57c00', '#e64a19', '#5d4037', '#616161', '#455a64',
    '#ffffff', '#000000'
];


const memberSchema = z.object({
  playerId: z.string(),
  number: z.coerce.number().min(1, "N°").max(99, "N°"),
});

const createTeamSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  jersey: z.object({
    style: z.custom<JerseyStyle>(val => typeof val === 'string' && val.length > 0, "Debes elegir un estilo."),
    primaryColor: z.string().min(1, "Debes elegir un color primario."),
    secondaryColor: z.string().min(1, "Debes elegir un color secundario."),
  }),
  formation: z.string().min(1, "Debes seleccionar una formación."),
  members: z.array(memberSchema).min(1, 'Debes seleccionar al menos un miembro.'),
});
type CreateTeamFormData = z.infer<typeof createTeamSchema>;

const JerseyCreator = ({ control, form }: { control: any, form: any }) => {
    const jersey = form.watch('jersey');
    const selectedStyle = jersey.style;
    const requiresSecondaryColor = selectedStyle !== 'solid';

    return (
        <Controller
            name="jersey"
            control={control}
            render={({ field }) => (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                    <div className="w-full h-48 rounded-lg flex items-center justify-center p-4 bg-muted/50">
                        <div className="w-36 h-36">
                            <JerseyIcon style={jersey.style} primaryColor={jersey.primaryColor} secondaryColor={jersey.secondaryColor} />
                        </div>
                    </div>
                    <div className="space-y-4">
                         <div>
                            <Label>Estilo de Camiseta</Label>
                             <div className="grid grid-cols-2 gap-2 mt-1">
                                {jerseyStyles.map(style => (
                                    <div key={style.id} className={cn("border rounded-md p-2 cursor-pointer hover:border-primary", field.value.style === style.id && "border-primary ring-2 ring-primary")} onClick={() => field.onChange({ ...field.value, style: style.id })}>
                                        <div className="w-full h-12">
                                           <JerseyIcon style={style.id} primaryColor="#a1a1aa" secondaryColor="#e4e4e7" />
                                        </div>
                                        <p className="text-xs text-center font-medium mt-1">{style.name}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <Label>Color Primario</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {colorPalette.map(color => (
                                    <button key={`primary-${color}`} type="button" className="h-8 w-8 rounded-full border-2 transition-all" style={{ backgroundColor: color, borderColor: field.value.primaryColor === color ? 'hsl(var(--ring))' : 'transparent' }} onClick={() => field.onChange({ ...field.value, primaryColor: color })} />
                                ))}
                            </div>
                        </div>
                         <div className={cn("transition-all duration-300", !requiresSecondaryColor && "opacity-50 pointer-events-none")}>
                            <Label>Color Secundario</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {colorPalette.map(color => (
                                    <button key={`secondary-${color}`} type="button" className="h-8 w-8 rounded-full border-2 transition-all" style={{ backgroundColor: color, borderColor: field.value.secondaryColor === color ? 'hsl(var(--ring))' : 'transparent' }} onClick={() => requiresSecondaryColor && field.onChange({ ...field.value, secondaryColor: color })} />
                                ))}
                            </div>
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
            <Label>Formación Táctica Predeterminada</Label>
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
  const { fields, append, remove } = useFieldArray({ control, name: "members" });
  const [searchTerm, setSearchTerm] = useState('');

  const selectedPlayerIds = useMemo(() => new Set(fields.map(field => (field as any).playerId)), [fields]);

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
                <ScrollArea className="h-52 border rounded-md p-2">
                    {fields.length > 0 ? fields.map((field, index) => {
                        const player = groupPlayers.find(p => p.id === (field as any).playerId);
                        return (
                            <div key={field.id} className="flex items-center gap-2 p-1">
                                <Input type="number" placeholder="#" className="w-16 h-8 text-center" {...control.register(`members.${index}.number`)} />
                                <p className="flex-1 font-medium truncate">{player?.name}</p>
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(index)}>
                                    <span className="text-destructive">X</span>
                                </Button>
                            </div>
                        )
                    }) : <p className="text-center text-sm text-muted-foreground p-4">Aún no hay jugadores.</p>}
                </ScrollArea>
            </div>
            <div className="space-y-2">
                 <Label>Jugadores Disponibles</Label>
                 <Input placeholder="Buscar para agregar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                <ScrollArea className="h-44 border rounded-md p-2">
                    {availablePlayers.map(player => (
                        <div key={player.id} className="flex items-center gap-2 p-1 hover:bg-accent rounded-md cursor-pointer" onClick={() => append({ playerId: player.id, number: 1 })}>
                           <Avatar className="h-8 w-8"><AvatarImage src={player.photoUrl} /><AvatarFallback>{player.name.charAt(0)}</AvatarFallback></Avatar>
                           <p className="flex-1 font-medium truncate">{player.name}</p>
                           <PlusCircle className="h-4 w-4 text-muted-foreground" />
                        </div>
                    ))}
                    {availablePlayers.length === 0 && <p className="text-center text-sm text-muted-foreground p-2">No hay jugadores disponibles.</p>}
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

  const { control, trigger, handleSubmit, watch, reset } = form;

  const nextStep = async () => {
    let fieldsToValidate: (keyof CreateTeamFormData | `jersey.${keyof CreateTeamFormData['jersey']}` | `members`)[] = [];
    if (step === 1) fieldsToValidate = ['name'];
    if (step === 2) fieldsToValidate = ['jersey.style', 'jersey.primaryColor'];
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
    } catch (error) {
        console.error('Error creating team:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear el equipo.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
          reset();
          setStep(1);
      }, 200)
    }
  }, [open, reset]);
  
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
            <div className={cn("min-h-[300px]", step !== 1 ? 'hidden' : '')}>
                <Label htmlFor="team-name">Nombre del Equipo</Label>
                <Input id="team-name" {...form.register('name')} placeholder="Ej: Furia Roja" />
                {form.formState.errors.name && <p className="text-destructive text-xs mt-1">{form.formState.errors.name.message}</p>}
            </div>

            <div className={cn("min-h-[300px]", step !== 2 ? 'hidden' : '')}><JerseyCreator control={control} form={form} /></div>
            <div className={cn("min-h-[300px]", step !== 3 ? 'hidden' : '')}><FormationSelector control={control} /></div>
            <div className={cn("min-h-[300px]", step !== 4 ? 'hidden' : '')}><MemberManager control={control} groupPlayers={groupPlayers} /></div>

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

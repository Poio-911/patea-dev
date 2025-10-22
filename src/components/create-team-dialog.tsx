
'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller, useWatch, useFieldArray, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, PlusCircle, Shield, ArrowRight, ArrowLeft, Users } from 'lucide-react';
import { Player, GroupTeam, JerseyStyle, TeamMember } from '@/lib/types';
import { cn } from '@/lib/utils';
import { JerseyIcon } from './jerseys';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from './ui/carousel';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

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
    '#ffffff', '#000000', '#F472B6', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B'
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

const JerseyCreator = () => {
    const { control, setValue, formState: { errors } } = useFormContext<CreateTeamFormData>();
    const jersey = useWatch({ control, name: "jersey" });

    const handleStyleSelect = (styleId: JerseyStyle) => {
        setValue('jersey.style', styleId, { shouldValidate: true });
        if (styleId === 'solid') {
            setValue('jersey.secondaryColor', jersey.primaryColor, { shouldValidate: true });
        }
    };
    
    const requiresSecondaryColor = jersey.style !== 'solid';

    return (
        <div className="space-y-6">
            <div className="w-full h-48 rounded-lg flex items-center justify-center p-4 bg-muted/50">
                <div className="w-36 h-36">
                    <JerseyIcon style={jersey.style} primaryColor={jersey.primaryColor} secondaryColor={jersey.secondaryColor} />
                </div>
            </div>
            
            <div className="space-y-2">
                <Label>Estilo de Camiseta</Label>
                <div className="grid grid-cols-4 gap-2">
                    {jerseyStyles.map((style) => (
                        <button
                            key={style.id}
                            type="button"
                            className={cn(
                                "border-2 rounded-lg p-1 cursor-pointer transition-all w-full flex flex-col items-center gap-1",
                                jersey.style === style.id ? "border-primary ring-2 ring-primary" : "border-border"
                            )}
                            onClick={() => handleStyleSelect(style.id)}
                        >
                            <div className="w-12 h-12">
                                <JerseyIcon style={style.id} primaryColor="#a1a1aa" secondaryColor={style.id === 'solid' ? "#a1a1aa" : "#e4e4e7"} />
                            </div>
                            <p className="text-xs text-center font-medium">{style.name}</p>
                        </button>
                    ))}
                </div>
                {errors.jersey?.style && <p className="text-destructive text-xs mt-1 text-center">{errors.jersey.style.message}</p>}
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <div>
                    <Label>Color Primario</Label>
                    <div className="grid grid-cols-7 gap-2 mt-1">
                        {colorPalette.map(color => (
                            <button
                                key={`primary-${color}`}
                                type="button"
                                className="h-8 w-8 rounded-full border-2 transition-all"
                                style={{ backgroundColor: color, borderColor: jersey.primaryColor === color ? 'hsl(var(--ring))' : 'transparent' }}
                                onClick={() => {
                                    setValue('jersey.primaryColor', color, { shouldValidate: true });
                                    if (!requiresSecondaryColor) {
                                        setValue('jersey.secondaryColor', color, { shouldValidate: true });
                                    }
                                }}
                            />
                        ))}
                    </div>
                    {errors.jersey?.primaryColor && <p className="text-destructive text-xs mt-1">{errors.jersey.primaryColor.message}</p>}
                </div>
                <div className={cn("transition-all duration-300", !requiresSecondaryColor && "opacity-20 pointer-events-none")}>
                    <Label>Color Secundario</Label>
                    <div className="grid grid-cols-7 gap-2 mt-1">
                        {colorPalette.map(color => (
                            <button
                                key={`secondary-${color}`}
                                type="button"
                                className="h-8 w-8 rounded-full border-2 transition-all"
                                style={{ backgroundColor: color, borderColor: jersey.secondaryColor === color ? 'hsl(var(--ring))' : 'transparent' }}
                                onClick={() => requiresSecondaryColor && setValue('jersey.secondaryColor', color, { shouldValidate: true })}
                            />
                        ))}
                    </div>
                    {requiresSecondaryColor && errors.jersey?.secondaryColor && <p className="text-destructive text-xs mt-1">{errors.jersey.secondaryColor.message}</p>}
                </div>
            </div>
        </div>
    );
};

const FormationSelector = ({ control, form }: { control: any, form: any }) => (
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
             {form.formState.errors.formation && <p className="text-destructive text-xs mt-1">{form.formState.errors.formation.message}</p>}
        </div>
    )}
  />
);

const MemberManager = ({ groupPlayers }: { groupPlayers: Player[] }) => {
    const { control, formState: { errors } } = useFormContext<CreateTeamFormData>();
    const { fields, append, remove } = useFieldArray({
        control,
        name: "members"
    });
    const watchedMembers = useWatch({ control, name: "members" });
    const selectedPlayerIds = new Set(watchedMembers.map((m: any) => m.playerId));

    return (
        <div className="space-y-4">
            <Label>Miembros del Equipo ({fields.length})</Label>
            <ScrollArea className="h-72 border rounded-md p-2">
                <div className="space-y-2">
                    {groupPlayers.map((player, index) => {
                        const fieldIndex = watchedMembers.findIndex((m: any) => m.playerId === player.id);
                        const isSelected = fieldIndex !== -1;
                        return (
                            <div key={player.id} className={cn("p-2 rounded-md flex items-center gap-2 transition-colors", isSelected ? 'bg-accent' : 'hover:bg-muted/50')}>
                                <Checkbox
                                    id={`member-${player.id}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            append({ playerId: player.id, number: index + 1 });
                                        } else {
                                            const removeIndex = watchedMembers.findIndex((m: any) => m.playerId === player.id);
                                            if (removeIndex > -1) {
                                                remove(removeIndex);
                                            }
                                        }
                                    }}
                                />
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={player.photoUrl} alt={player.name} />
                                    <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <Label htmlFor={`member-${player.id}`} className="flex-1 cursor-pointer font-semibold">{player.name}</Label>
                                {isSelected && (
                                    <Controller
                                        control={control}
                                        name={`members.${fieldIndex}.number`}
                                        render={({ field }) => (
                                            <Input
                                                {...field}
                                                type="number"
                                                className="h-8 w-20"
                                                placeholder="N°"
                                            />
                                        )}
                                    />
                                )}
                            </div>
                        )
                    })}
                </div>
            </ScrollArea>
             {errors.members && <p className="text-destructive text-xs mt-1">{errors.members.message}</p>}
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
      jersey: { style: 'solid', primaryColor: '#d32f2f', secondaryColor: '#d32f2f' },
      formation: '4-4-2',
      members: [],
    },
  });

  const { control, trigger, handleSubmit, reset } = form;

  const nextStep = async () => {
    let fieldsToValidate: (keyof CreateTeamFormData | `jersey.${keyof CreateTeamFormData['jersey']}` | `members`)[] = [];
    if (step === 1) fieldsToValidate = ['name'];
    if (step === 2) fieldsToValidate = ['jersey.style', 'jersey.primaryColor', 'jersey.secondaryColor'];
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
      reset({
        name: '',
        jersey: { style: 'solid', primaryColor: '#d32f2f', secondaryColor: '#d32f2f' },
        formation: '4-4-2',
        members: [],
      });
      setStep(1);
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
            <FormProvider {...form}>
                <div className={cn("min-h-[400px]", step !== 1 ? 'hidden' : 'pt-4')}>
                    <Label htmlFor="team-name">Nombre del Equipo</Label>
                    <Input id="team-name" {...form.register('name')} placeholder="Ej: Furia Roja" />
                    {form.formState.errors.name && <p className="text-destructive text-xs mt-1">{form.formState.errors.name.message}</p>}
                </div>

                <div className={cn("min-h-[400px]", step !== 2 ? 'hidden' : '')}><JerseyCreator /></div>
                <div className={cn("min-h-[400px]", step !== 3 ? 'hidden' : 'pt-4')}><FormationSelector control={control} form={form} /></div>
                <div className={cn("min-h-[400px]", step !== 4 ? 'hidden' : 'pt-4')}><MemberManager groupPlayers={groupPlayers} /></div>

                <DialogFooter className="pt-4">
                    {step > 1 && <Button type="button" variant="outline" onClick={prevStep}><ArrowLeft className="mr-2 h-4 w-4" />Anterior</Button>}
                    <div className="flex-grow"></div>
                    {step < 4 && <Button type="button" onClick={nextStep}>Siguiente<ArrowRight className="ml-2 h-4 w-4" /></Button>}
                    {step === 4 && <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}Crear Equipo</Button>}
                </DialogFooter>
            </FormProvider>
        </form>
      </DialogContent>
    </Dialog>
  );
}

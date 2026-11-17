import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../core/models/competition_model.dart';
import '../../core/models/group_model.dart';
import '../../core/services/competition_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/patea_background.dart';
import '../../core/widgets/patea_button_progress.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_states.dart';
import '../../core/widgets/jersey_painter.dart';

String competitionError(Object e) => e.toString().replaceFirst('Exception: ','').replaceFirst('Bad state: ','').replaceFirst('Invalid argument(s): ','');
class CreateCompetitionScreen extends ConsumerStatefulWidget {
 final bool isCup;
 final String groupId;
 final CompetitionModel? competition;
 const CreateCompetitionScreen({super.key,required this.isCup,required this.groupId,this.competition});
 @override
 ConsumerState<CreateCompetitionScreen> createState()=>_CompetitionEditorState();
}
class _CompetitionEditorState extends ConsumerState<CreateCompetitionScreen> {
 final _requestId=const Uuid().v4();
 final _name=TextEditingController(),_description=TextEditingController(),_venue=TextEditingController(),_address=TextEditingController();
 final _selected=<String>{};
 int _step=0,_capacity=16,_win=3,_draw=1;
 bool _saving=false,_public=false,_returnLeg=false;
 String _frequency='weekly',_time='21:00',_date='';
 String? _error;
 @override
 void initState(){super.initState();final c=widget.competition;
 _capacity=c?.maxTeams??(widget.isCup?32:16);_name.text=c?.name??'';_description.text=c?.description??'';
 _venue.text=c?.defaultLocation['name']?.toString()??'';_address.text=c?.defaultLocation['address']?.toString()??'';
 _public=c?.isPublic??false;_returnLeg=c?.format=='double_round_robin';_frequency=c?.matchFrequency??'weekly';_time=c?.matchTime??'21:00';_date=c?.startDate?.split('T').first??'';
 _selected.addAll(c?.teamIds??[]);_win=(c?.rules['pointsForWin'] as num?)?.toInt()??3;_draw=(c?.rules['pointsForDraw'] as num?)?.toInt()??1;
 }
 @override
 void dispose(){for(final c in [_name,_description,_venue,_address]){c.dispose();}super.dispose();}
 Map<String,dynamic> get _data=>{'name':_name.text.trim(),'description':_description.text.trim(),'groupId':widget.groupId,'teams':_selected.toList(),'isPublic':_public,'format':_returnLeg?'double_round_robin':'round_robin','maxTeams':_capacity,'startDate':_date,'matchTime':_time,'matchFrequency':_frequency,'rules':{'pointsForWin':_win,'pointsForDraw':_draw},'defaultLocation':{'name':_venue.text.trim(),'address':_address.text.trim(),'lat':0,'lng':0,'placeId':''}};
 bool _valid(){
 String? error;
 if(_step==0&&_name.text.trim().length<3)error='El nombre necesita al menos tres caracteres.';
 if(_step==1&&(!_public&&_selected.length<2))error='Elegí al menos dos equipos, o abrí las inscripciones.';
 if(_selected.length>_capacity)error='El cupo es menor que la cantidad de equipos seleccionados.';
 if(_step==2&&!widget.isCup&&_draw>=_win)error='Ganar debe sumar más puntos que empatar.';
 setState(()=>_error=error);return error==null;
 }
 Future<void> _next() async {
 if(_saving||!_valid())return;
 FocusScope.of(context).unfocus();if(_step<2){setState(()=>_step++);return;}
 setState((){_saving=true;_error=null;});
 try{final service=ref.read(competitionServiceProvider),collection=widget.isCup?'cups':'leagues';
 if(widget.competition!=null){await service.command(collection,widget.competition!.id,'configure',_data);if(mounted)Navigator.pop(context,true);}else{final id=await service.create(collection:collection,requestId:_requestId,data:_data);if(mounted)Navigator.pop(context,id);}
 }catch(e){if(mounted)setState((){_saving=false;_error=competitionError(e);});}
 }
 Future<void> _pickDate() async {
 final now=DateTime.now(),old=DateTime.tryParse(_date),initial=old!=null&&old.isAfter(now)?old:now.add(const Duration(days:7));
 final day=await showDatePicker(context:context,initialDate:initial,firstDate:now,lastDate:DateTime(now.year+3));
 if(day!=null&&mounted)setState(()=>_date='${day.year}-${day.month.toString().padLeft(2,'0')}-${day.day.toString().padLeft(2,'0')}');
 }
 @override
 Widget build(BuildContext context){
 final group=ref.watch(groupTeamsStreamProvider(widget.groupId));
 return Scaffold(backgroundColor:Colors.transparent,
 appBar:AppBar(backgroundColor:Colors.transparent,title:Text(widget.competition!=null?'Configurar torneo':widget.isCup?'Crear copa':'Crear liga',style:AppTypography.headline(size:20))),
 body:PateaBackground(child:Column(children:[
 Padding(padding:const EdgeInsets.fromLTRB(20,4,20,16),child:Column(children:[
 Row(children:[for(var i=0;i<3;i++)Expanded(child:Text(['Identidad','Equipos','Calendario'][i],style:AppTypography.body(size:13,weight:_step==i?FontWeight.w700:FontWeight.w400,color:_step==i?context.c.primary:context.c.textSecondary)))]),
 const SizedBox(height:12),LinearProgressIndicator(value:(_step+1)/3,minHeight:3),
 ])),
 Expanded(child:ListView(padding:const EdgeInsets.fromLTRB(20,4,20,24),children:[
 if(_step==0)...[
 Text('Un torneo con identidad propia',style:AppTypography.headline(size:24)),const SizedBox(height:18),
 TextField(controller:_name,maxLength:80,textCapitalization:TextCapitalization.sentences,decoration:const InputDecoration(labelText:'Nombre del torneo'),enabled:!_saving),
 const SizedBox(height:16),TextField(controller:_description,maxLength:500,maxLines:3,decoration:const InputDecoration(labelText:'Descripción y acuerdos del torneo'),enabled:!_saving),
 SwitchListTile(contentPadding:EdgeInsets.zero,value:_public,onChanged:_saving?null:(v)=>setState(()=>_public=v),title:const Text('Abrir inscripciones'),subtitle:const Text('Otros equipos pueden postularse. Vos aprobás quién participa.')),
 const SizedBox(height:12),DropdownButtonFormField<int>(initialValue:_capacity,isExpanded:true,decoration:const InputDecoration(labelText:'Cupo de equipos'),items:[for(final n in ({...List.generate((widget.isCup?32:16)-1,(i)=>i+2),_capacity}.toList()..sort()))DropdownMenuItem(value:n,child:Text('$n equipos'))],onChanged:_saving?null:(v)=>setState(()=>_capacity=v!)),
 ],
 if(_step==1)...[
 Text('Los equipos hacen el torneo',style:AppTypography.headline(size:24)),const SizedBox(height:8),
 Text(_public?'Podés empezar sin equipos y aprobar solicitudes más adelante.':'Elegí los equipos de tu grupo.',style:AppTypography.body(size:14,color:context.c.textSecondary)),
 if(widget.isCup)const Padding(padding:EdgeInsets.symmetric(vertical:12),child:Text('Para sortear la copa se necesitan 2, 4, 8, 16 o 32 equipos.')),
 Text('${_selected.length} de $_capacity equipos',style:AppTypography.body(size:15,weight:FontWeight.w600)),
 group.when(loading:()=>const PateaLoading(),error:(e,_)=>PateaError(error:e),data:(teams)=>Column(children:[
 for(final team in teams)CheckboxListTile(contentPadding:EdgeInsets.zero,secondary:JerseyWidget(jersey:team.jersey,size:36),title:Text(team.name,style:AppTypography.body(size:16)),subtitle:Text('${team.members.length} jugadores'),value:_selected.contains(team.id),onChanged:_saving?null:(v)=>setState((){if(v==true){_selected.add(team.id);}else{_selected.remove(team.id);}})),
 for(final id in _selected.where((id)=>!teams.any((t)=>t.id==id)))ListTile(contentPadding:EdgeInsets.zero,leading:const Icon(Icons.public),title:Text(widget.competition?.teamSnapshots[id]?['name']?.toString()??'Equipo externo'),subtitle:const Text('Participante de otro grupo'),trailing:IconButton(tooltip:'Retirar del borrador',icon:const Icon(Icons.remove_circle_outline),onPressed:_saving?null:()=>setState(()=>_selected.remove(id)))),
 if(teams.isEmpty)const Padding(padding:EdgeInsets.all(16),child:Text('Creá equipos desde Gestionar grupos, o abrí las inscripciones.')),
 ])),
 ],
 if(_step==2)...[
 Text('La primera fecha, a tu ritmo',style:AppTypography.headline(size:24)),const SizedBox(height:8),
 Text('Podés dejar el inicio por definir y programarlo al comenzar.',style:AppTypography.body(size:14,color:context.c.textSecondary)),const SizedBox(height:16),
 ListTile(contentPadding:EdgeInsets.zero,leading:const Icon(Icons.calendar_today_outlined),title:Text(_date.isEmpty?'Inicio por definir':_date),onTap:_saving?null:_pickDate,trailing:_date.isNotEmpty?IconButton(tooltip:'Quitar fecha',icon:const Icon(Icons.close),onPressed:()=>setState(()=>_date='')):const Icon(Icons.chevron_right)),
 ListTile(contentPadding:EdgeInsets.zero,leading:const Icon(Icons.schedule),title:Text(_time),onTap:_saving?null:() async{final raw=_time.split(':');final t=await showTimePicker(context:context,initialTime:TimeOfDay(hour:int.tryParse(raw[0])??21,minute:int.tryParse(raw.last)??0));if(t!=null&&mounted)setState(()=>_time='${t.hour.toString().padLeft(2,'0')}:${t.minute.toString().padLeft(2,'0')}');}),
 if(!widget.isCup)...[
 SwitchListTile(contentPadding:EdgeInsets.zero,title:const Text('Ida y vuelta'),value:_returnLeg,onChanged:_saving?null:(v)=>setState(()=>_returnLeg=v)),
 DropdownButtonFormField<String>(initialValue:_frequency,decoration:const InputDecoration(labelText:'Frecuencia de las jornadas'),items:const [DropdownMenuItem(value:'weekly',child:Text('Cada semana')),DropdownMenuItem(value:'biweekly',child:Text('Cada dos semanas'))],onChanged:_saving?null:(v)=>setState(()=>_frequency=v!)),const SizedBox(height:20),
 Wrap(spacing:16,runSpacing:12,children:[SizedBox(width:125,child:DropdownButtonFormField<int>(initialValue:_win,decoration:const InputDecoration(labelText:'Puntos al ganar'),items:[for(var i=1;i<=10;i++)DropdownMenuItem(value:i,child:Text('$i'))],onChanged:_saving?null:(v)=>setState(()=>_win=v!))),SizedBox(width:125,child:DropdownButtonFormField<int>(initialValue:_draw,decoration:const InputDecoration(labelText:'Al empatar'),items:[for(var i=0;i<10;i++)DropdownMenuItem(value:i,child:Text('$i'))],onChanged:_saving?null:(v)=>setState(()=>_draw=v!)))]),
 ],
 const SizedBox(height:20),TextField(controller:_venue,decoration:const InputDecoration(labelText:'Cancha o sede'),enabled:!_saving),const SizedBox(height:16),TextField(controller:_address,decoration:const InputDecoration(labelText:'Dirección de referencia'),enabled:!_saving),
 ],
 if(_error!=null)Padding(padding:const EdgeInsets.symmetric(vertical:16),child:Text(_error!,style:AppTypography.body(size:14,color:context.c.destructive))),
 ])),
 ])),
 bottomNavigationBar:Padding(padding:EdgeInsets.only(bottom:MediaQuery.viewInsetsOf(context).bottom),child:SafeArea(top:false,child:Padding(padding:const EdgeInsets.all(16),child:Row(children:[if(_step>0)...[OutlinedButton(onPressed:_saving?null:()=>setState((){_step--;_error=null;}),child:const Text('Atrás')),const SizedBox(width:12)],Expanded(child:FilledButton.icon(onPressed:_saving?null:_next,icon:_saving?const PateaButtonProgress():Icon(_step==2?Icons.check:Icons.arrow_forward),label:Text(_saving?'Guardando…':_step<2?'Continuar':widget.competition!=null?'Guardar cambios':_public?'Abrir inscripciones':'Guardar torneo')))])))),
 );}
}
Future<bool> confirmDeleteCompetition(BuildContext context,WidgetRef ref,CompetitionModel comp) async {
 final accepted=await showDialog<bool>(context:context,builder:(context)=>AlertDialog(title:Text('¿Eliminar ${comp.name}?'),content:const Text('Se eliminará este borrador y sus solicitudes. Si ya tiene partidos, se debe archivar para conservar el historial.'),actions:[TextButton(onPressed:()=>Navigator.pop(context,false),child:const Text('Cancelar')),FilledButton(onPressed:()=>Navigator.pop(context,true),child:const Text('Eliminar borrador'))]));
 if(accepted!=true)return false;
 try{await ref.read(competitionServiceProvider).command(comp.type=='cup'?'cups':'leagues',comp.id,'deleteDraft');return true;}catch(e){if(context.mounted)PateaSnack.error(context,competitionError(e));return false;}
}

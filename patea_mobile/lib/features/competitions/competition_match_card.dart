import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/group_model.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/patea_card.dart';
import 'competition_insights.dart';

class CompetitionMatchCard extends StatelessWidget {
 final Map<String,dynamic> match;
 final VoidCallback? schedule,result;
 final bool busy;
 const CompetitionMatchCard({super.key,required this.match,this.schedule,this.result,this.busy=false});
 @override
 Widget build(BuildContext context){
 final teams=match['teams'] as List? ?? [],score=competitionScore(match),live=match['status']=='active',done=confirmedMatch(match);
 Map side(int i)=>teams.length>i?teams[i] as Map:{};
 final day=DateTime.tryParse((match['date']??'').toString());
 final place=match['location'] is Map?match['location'] as Map:{};
 final pair=match['participantTeamIds'] as List? ?? [];
 final penalty=pair.indexOf(match['penaltyWinnerId']);
 return PateaCard(color:context.c.card,borderColor:context.c.border,padding:const EdgeInsets.all(16),child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
 Wrap(spacing:12,runSpacing:4,children:[Text(matchState(match['status'] as String?),style:AppTypography.body(size:13,weight:FontWeight.w600,color:live?context.c.primary:context.c.textSecondary)),if(day!=null)Text('${day.day}/${day.month} · ${match['time']??''}',style:AppTypography.body(size:13,color:context.c.textSecondary))]),const SizedBox(height:14),
 Row(crossAxisAlignment:CrossAxisAlignment.center,children:[
 for(var i=0;i<2;i++)...[
 if(i==1)Padding(padding:const EdgeInsets.symmetric(horizontal:12),child:Text(done&&score!=null?'${score['team1']} — ${score['team2']}':'vs',style:done&&score!=null?AppTypography.sportNumber(size:28):AppTypography.body(size:20,color:context.c.textSecondary))),
 Expanded(child:Column(children:[JerseyWidget(jersey:JerseyModel.fromMap(side(i)['jersey'] is Map?Map<String,dynamic>.from(side(i)['jersey']):null),size:42),const SizedBox(height:8),Text((side(i)['name']??'Equipo por definir').toString(),textAlign:TextAlign.center,style:AppTypography.body(size:15,weight:FontWeight.w600))])),
 ]],),
 if(penalty>=0&&penalty<2)Padding(padding:const EdgeInsets.only(top:10),child:Text('${side(penalty)['name']??'Equipo'} ganó por penales',textAlign:TextAlign.center,style:AppTypography.body(size:13,color:context.c.primary))),
 if((place['name']??'').toString().isNotEmpty)Padding(padding:const EdgeInsets.only(top:12),child:Text(place['name'].toString(),style:AppTypography.body(size:13,color:context.c.textSecondary))),const SizedBox(height:8),
 Wrap(spacing:8,runSpacing:4,children:[TextButton.icon(onPressed:()=>context.push('/matches/${match['id']}'),icon:const Icon(Icons.open_in_new,size:18),label:const Text('Abrir partido')),
 if(schedule!=null)TextButton.icon(onPressed:busy?null:schedule,icon:const Icon(Icons.edit_calendar_outlined,size:18),label:const Text('Programar')),
 if(result!=null)TextButton.icon(onPressed:busy?null:result,icon:const Icon(Icons.sports_score,size:18),label:Text(done?'Resolver penales':'Cargar resultado')),
 ]),
 ]));
 }
}

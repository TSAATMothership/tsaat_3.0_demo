"""Render the active, caption-led TSAAT Overview motion-graphics videos.

Usage: python scripts/build_overview_videos.py [SECTION ...] [--ffmpeg PATH]
Requires Pillow and an H.264 FFmpeg encoder; uses build/video-tools as fallback.
All graphics are authored here. No stock media, remote services or runtime fonts
are required. Captions repeat the visible narrative; films intentionally have no
soundtrack. Existing guide builds consume the committed MP4s/posters/captions.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT, FPS = 1280, 720, 24
NAVY = '#091722'
TEAL = '#7ce9d5'
BLUE = '#8edcff'
AMBER = '#f3ba79'
WHITE = '#eef6f7'
MUTED = '#b4cad4'
ORANGE = '#f6aa63'
CYAN = '#76dce9'
GREEN = '#70e3a1'
PURPLE = '#c7b7ff'
SYSTEM_MEMBERS = {'A': ('D1','D2'), 'B': ('D3','D4'), 'C': ('D5','D6')}
SOFTWARE_DEVICES = {'D1','D3','D5'}
SERVICE_SYSTEMS = {'ICT service': ('A',), 'Mission service A': ('B','C'), 'Mission service B': ('C',)}
FONT_DIR = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts'
FONT_REG = FONT_DIR / 'segoeui.ttf'
FONT_BOLD = FONT_DIR / 'segoeuib.ttf'
FONT_LIGHT = FONT_DIR / 'segoeuil.ttf'
FONT_CACHE = {}

FILMS = {
 'what': {
  'title':'What is TSAAT?', 'label':'Turn observations into context', 'seconds':6,
  'scenes':[
   ['Turn observations\ninto context.', 'Threat Surface Area Assessment Tool (TSAAT)', 'TSAAT brings recorded observations about the cyber terrain together into a context aware data set.'],
   ['See the\nconnected terrain.', 'Devices. Software. Networks. Services.', 'Explore how configuration items and ICT systems connect to mission services and business services.'],
   ['Govern the\ncyber posture.', 'Defence Cyber Terrain (DCT)', 'TSAAT assists cyber teams in governing the cyber posture of the Defence Cyber Terrain and reducing the threat surface area of networks and ICT systems.'],
   ['Understand.\nInvestigate. Report.', 'Put the observations to work', 'Understand the cyber terrain, investigate an issue or finding, and turn insights into a report.']
  ]},
 'origins': {
  'title':'Where did it come from?', 'label':'From discovery to understanding', 'seconds':6,
  'scenes':[
   ['2019', 'The foundation', 'OPORD/01-2019 starts CMDB and dynamic discovery. An enterprise platform reaches DPE and DSE by June 2022.'],
   ['Q3 2022', 'Make the connections', 'Configuration Management processes are established, including ICT System Modelling.'],
   ['2023-24', 'Assess the critical systems', 'DSR: HICTO orders 66 and 67 assess about 87 critical ICT Systems against 28 compliance questions. TSAAT v1.0 reports the findings.'],
   ['2024-25', 'Scale the inventory', 'DIIS captures ICT System inventory and ownership. OMWOW models about 3,000 systems. TSAAT v2.0 and training arrive in Q4 2025.'],
   ['Q1 2026', 'A wider conversation', 'TSAAT is presented to DSOC and Cyber Command as a reporting tool for visibility of the Cyber Terrain.'],
   ['Jan 2027', 'The next chapter - planned', 'TSAAT v3.0 is designed in Q4 2026 for DSOC needs, with delivery planned for January 2027.']
  ]},
 'terrain': {
  'title':'What is the Cyber Terrain?', 'label':'Explore the connected cyber terrain', 'seconds':6,
  'scenes':[
   ['See the\nwhole terrain.', 'An illustrative topology', 'Mission services and business services depend on ICT systems, networks and configuration items, or CIs.'],
   ['Inspect the\nbuilding blocks.', 'Devices + installed software', 'Servers, workstations and other CIs form the technical foundation. Blue SW icons identify software installed on servers.'],
   ['Follow the\nconnections.', 'Multiple networks + ICT systems', 'Communication paths connect CIs across networks. Recorded system membership gives those components a shared purpose.'],
   ['Connect to\nservice purpose.', 'Mission services + business services', 'Follow dependencies to see which systems support each service. Select a layer in the guide, or highlight all components.']
  ]},
 'vulnerabilities': {
  'title':'Security vulnerabilities', 'label':'A signal to investigate', 'seconds':6,
  'scenes':[
   ['A finding is\na starting point.', 'Security vulnerabilities', 'A vulnerability observation records a potential weakness associated with a device or software.'],
   ['Add the\ncontext.', 'Which device? Which software?', 'Examine the affected records, recorded CVE details and the source that reported the observation.'],
   ['Separate\nsignal from proof.', 'Observation is not exploitation', 'A recorded finding is not proof that a weakness is exploitable or has been exploited.'],
   ['Investigate.\nThen prioritise.', 'Evidence supports judgement', 'Trace D3 to System B, Mission service A and Business service B. Validate the evidence and service relevance before deciding on action.']
  ]},
 'shadow': {
  'title':'Shadow IT', 'label':'Make the unknown visible', 'seconds':6,
  'scenes':[
   ['An endpoint\nsees an address.', 'Scenario 1 / Current example', 'Known endpoint D3 reports communication with 192.0.2.87, which has no matching endpoint record.'],
   ['A network device\ncommunicates.', 'Scenario 2 / Network device', 'Known network device ND1 communicates with unmatched address 198.51.100.64. Keep the two endpoints separate.'],
   ['Discovery finds\nan unknown type.', 'Scenario 3 / CMDB discovery scan', 'CMDB discovery scans an IP range and detects 192.0.2.47, but cannot classify it as a Server, Computer, Printer or Router.'],
   ['Investigate\nthe gap.', 'Identify. Classify. Validate.', 'Check the source and evidence, then establish identity, device type and ownership. An unknown address is not proof of malicious activity.']
  ]},
 'services': {
  'title':'Service impacts', 'label':'Trace what depends on what', 'seconds':6,
  'scenes':[
   ['A device issue.\nBusiness context.', 'D1 / ICT System A', 'D1 belongs to System A. Business services A and B depend on that system, so review both services.'],
   ['Shared mission\nsupport.', 'D5 / ICT System C', 'D5 belongs to System C, which supports Mission services A and B. Mission service A also depends on System B.'],
   ['A device link\nis unavailable.', 'D7 / D3', 'The link joins D7 in System A and D3 in System B. Review Business services A and B and Mission service A, and check alternative paths.'],
   ['Review does not\nmean outage.', 'Validate with the service owner', 'Confirm the recorded dependencies, alternative paths and current service state before concluding that a service is affected.']
  ]},
 'reporting': {
  'title':'Reporting and focused insights', 'label':'Watch observations become a focused report.', 'seconds':8,
  'scenes':[
   ['Filter. Build.\nShare the rows.', 'Filtered Excel', 'Start with the header scope, apply Explorer search, then export every matching row across all pages. Here, searching for D5 includes D5.'],
   ['Scope. Summarise.\nBrief the terrain.', 'Briefing PDF', 'Keep every device in the applied header scope and loaded snapshot. The briefing includes D5 and D6 in System C, even when Explorer search shows only D5.'],
   ['Start. Trace.\nShare the evidence.', 'Impact PDF', 'Follow a starting CI through its ICT system to dependent services. Package the full traced graph and supporting evidence with the selected scope and snapshot.']
  ]},
 'benefits': {
  'title':'TSAAT benefits', 'label':'A clearer picture. A better conversation.', 'seconds':6,
  'scenes':[
   ['See what\nyou have.', 'Visibility', 'Bring recorded inventory, relationships and observations into a view people can explore.'],
   ['Find the\nquestions.', 'Investigation', 'Spot missing details and follow the evidence behind summaries and findings.'],
   ['Share the\nunderstanding.', 'Communication', 'Use consistent views, reports and exports to discuss the same evidence.'],
   ['Know the terrain.\nTake the next step.', 'Explore the TSAAT Feature Guide', 'Choose a feature, learn how it works and practise using the guide.']
  ]}
}

# Follow the overview's reading sequence. The investigation introduction groups
# its three videos; the retired systems chapter is covered by the terrain video.
FILMS = {key: FILMS[key] for key in (
    'what', 'origins', 'terrain', 'vulnerabilities', 'shadow', 'services',
    'reporting', 'benefits')}
OVERVIEW_SECTIONS = {section['id']: section for section in json.loads(
    (ROOT / 'src/overview-content.json').read_text(encoding='utf-8'))['sections']}
for section_id, film in FILMS.items():
    film['title'] = OVERVIEW_SECTIONS[section_id]['title']
    film['number'] = OVERVIEW_SECTIONS[section_id]['number']


def font(size, bold=False, light=False):
    key = (size, bold, light)
    if key not in FONT_CACHE:
        source = FONT_BOLD if bold else FONT_LIGHT if light else FONT_REG
        if not source.exists():
            raise FileNotFoundError('Segoe UI fonts not found. Set WINDIR to the installed Windows font root.')
        FONT_CACHE[key] = ImageFont.truetype(str(source), size)
    return FONT_CACHE[key]


def rgb(hex_color):
    h = hex_color.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0,2,4))


def blend(a, b, t):
    return tuple(round(x+(y-x)*t) for x,y in zip(rgb(a), rgb(b)))


def clamp(value):
    return max(0, min(1, value))


def ease(value):
    return 1-(1-clamp(value))**3


def line(draw, points, fill=TEAL, width=2):
    draw.line(points, fill=fill, width=width, joint='curve')


def label(draw, xy, text, fill=MUTED, size=16, bold=False, anchor=None):
    draw.text(xy, text, fill=fill, font=font(size,bold), anchor=anchor)


def wrap(text, width, face):
    measure=ImageDraw.Draw(Image.new('RGB',(1,1)))
    words=text.split(); lines=[]; current=''
    for word in words:
        candidate=(current+' '+word).strip()
        if current and measure.textlength(candidate,font=face)>width:
            lines.append(current); current=word
        else: current=candidate
    if current: lines.append(current)
    return lines


def paragraph(draw, xy, text, max_width, size=22, fill=MUTED, line_height=33):
    x,y=xy
    for item in wrap(text,max_width,font(size)):
        label(draw,(x,y),item,fill,size);y+=line_height
    return y


def point_on_path(points, value):
    distances=[math.dist(a,b) for a,b in zip(points,points[1:])]
    target=clamp(value)*sum(distances)
    for a,b,d in zip(points,points[1:],distances):
        if target<=d:
            f=target/d if d else 0
            return a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f
        target-=d
    return points[-1]


def route(draw, points, time, color=CYAN, width=2):
    """One clear connection cue per chapter, followed by a stable reading hold."""
    line(draw,points,blend(NAVY,color,.55),width)
    progress=clamp(((time%6)-.65)/2.5)
    if 0<progress<1:
        x,y=point_on_path(points,progress)
        draw.ellipse((x-4,y-4,x+4,y+4),fill=color)


def entity_device(draw,x,y,identity,scale=1,show_label=True,highlight=False,software=None):
    def pts(items):return [(x+px*scale,y+py*scale) for px,py in items]
    outline=AMBER if highlight else ORANGE
    draw.polygon(pts([(0,-56),(28,-42),(28,-14),(0,0),(-28,-14),(-28,-42)]),fill='#30291f')
    draw.polygon(pts([(0,-56),(28,-42),(0,-28),(-28,-42)]),fill='#704523')
    line(draw,pts([(0,-56),(28,-42),(28,-14),(0,0),(-28,-14),(-28,-42),(0,-56)]),outline,2)
    line(draw,pts([(-28,-42),(0,-28),(28,-42)]),outline,2)
    line(draw,pts([(0,-28),(0,0)]),outline,2)
    line(draw,pts([(-20,-29),(-8,-23)]),outline,1)
    line(draw,pts([(-20,-22),(-8,-16)]),outline,1)
    if (identity in SOFTWARE_DEVICES if software is None else software) and scale >= .6:
        line(draw,pts([(19,-31),(29,-49)]),BLUE,2)
        draw.rounded_rectangle((x+12*scale,y-67*scale,x+51*scale,y-36*scale),radius=4,fill='#153b50',outline=BLUE,width=2)
        label(draw,(x+31.5*scale,y-51*scale),'SW',BLUE,max(13,round(16*scale)),True,'mm')
    if show_label:label(draw,(x,y+21*scale),identity,ORANGE,max(16,round(20*scale)),True,'mm')
    if highlight:draw.ellipse((x-40*scale,y-65*scale,x+40*scale,y+9*scale),outline=AMBER,width=2)


def entity_system(draw,x,y,identity,scale=1,highlight=False):
    def pts(items):return [(x+px*scale,y+py*scale) for px,py in items]
    col=AMBER if highlight else GREEN
    draw.polygon(pts([(0,-80),(55,-53),(55,-9),(0,18),(-55,-9),(-55,-53)]),fill='#123b2e')
    draw.polygon(pts([(0,-80),(55,-53),(0,-26),(-55,-53)]),fill='#246544')
    line(draw,pts([(0,-80),(55,-53),(55,-9),(0,18),(-55,-9),(-55,-53),(0,-80)]),col,2)
    line(draw,pts([(-55,-53),(0,-26),(55,-53)]),col,2)
    line(draw,pts([(0,-26),(0,18)]),col,2)
    # The same fixed device membership appears in every film and in the page.
    for dx,dy,member in [(-21,-47,SYSTEM_MEMBERS[identity][0]),(21,-28,SYSTEM_MEMBERS[identity][1])]:
        entity_device(draw,x+dx*scale,y+dy*scale,member,.34*scale,False)
    label(draw,(x,y+43*scale),'System '+identity,GREEN,max(17,round(21*scale)),True,'mm')
    label(draw,(x,y+69*scale),' + '.join(SYSTEM_MEMBERS[identity]),ORANGE,max(15,round(17*scale)),False,'mm')


def entity_service(draw,x,y,identity,highlight=False):
    col=AMBER if highlight else PURPLE
    draw.rounded_rectangle((x-65,y-33,x+65,y+33),radius=10,fill='#282d48',outline=col,width=2)
    if identity=='ICT service':label(draw,(x,y),identity,PURPLE,20,True,'mm')
    else:
        label(draw,(x,y-10),'Mission service',PURPLE,16,True,'mm')
        label(draw,(x,y+13),identity[-1],PURPLE,23,True,'mm')


def report_symbol(draw,x,y,caption,color=TEAL):
    draw.rounded_rectangle((x-28,y-38,x+28,y+38),radius=5,fill='#112b38',outline=color,width=2)
    for dy,length in [(-21,34),(-8,34),(5,25),(18,34)]:line(draw,[(x-17,y+dy),(x-17+length,y+dy)],color,2)
    label(draw,(x,y+65),caption,MUTED,17,True,'mm')


NETWORK_LINKS=(('D1','D3'),('D3','D5'),('D1','D2'),('D3','D4'),('D5','D6'),('D4','D6'))
YELLOW='#ffe36e'


def network_points(top=210,gap=80):
    return {'D'+str(i+1):(772+(i//2)*175,top+(i%2)*gap) for i in range(6)}


def network_paths(draw,points,t,motion=True):
    for a,b in NETWORK_LINKS:
        if motion:route(draw,[points[a],points[b]],t,CYAN,2)
        else:line(draw,[points[a],points[b]],blend(NAVY,CYAN,.55),2)
    if motion:route(draw,[points['D2'],points['D4']],t,YELLOW,3)
    else:line(draw,[points['D2'],points['D4']],blend(NAVY,YELLOW,.75),3)


def entity_landscape(draw,t,services=True,network=True,trace=None,finding=None):
    """Read top down: the same paired device network, systems, then services."""
    xs={'A':772,'B':947,'C':1122}
    points=network_points()
    draw.rounded_rectangle((710,146,1204,336),radius=12,fill='#102633',outline='#294553',width=1)
    network_paths(draw,points,t,network)
    for identity,(x,y) in points.items():entity_device(draw,x,y,identity,.75,True,trace==identity or finding==identity)
    system_y=431
    for identity,x in xs.items():
        line(draw,[(x,340),(x,360)],blend(NAVY,GREEN,.65),2)
        line(draw,[(x-4,356),(x,360),(x+4,356)],blend(NAVY,GREEN,.65),2)
        entity_system(draw,x,system_y,identity,.78,trace=='D3' and identity=='B')
    if services:
        # Exact support edges: A -> ICT; B+C -> Mission A; C -> Mission B.
        paths=[([(815,414),(850,414),(850,580),(837,580)],False),
               ([(990,414),(1025,414),(1025,570),(1012,570)],trace=='D3'),
               ([(1165,414),(1200,414),(1200,520),(1045,520),(1045,596),(1012,596)],False),
               ([(1200,520),(1200,580),(1187,580)],False)]
        for edge,active in paths:route(draw,edge,t,AMBER if active else PURPLE,3 if active else 2)
        entity_service(draw,772,580,'ICT service')
        entity_service(draw,947,580,'Mission service A',trace=='D3')
        entity_service(draw,1122,580,'Mission service B')
    label(draw,(947,635 if services else 548),'ILLUSTRATIVE DEVICES, SYSTEMS AND SERVICES' if services else 'ONE NETWORK / THREE ICT SYSTEMS',MUTED,14,True,'mm')


def what_curve(draw,points,color=CYAN,width=1):
    """A conceptual relationship, without implying a physical traffic route."""
    a,b,c,d=points
    path=[]
    for i in range(49):
        u=i/48;v=1-u
        path.append((v**3*a[0]+3*v*v*u*b[0]+3*v*u*u*c[0]+u**3*d[0],
                     v**3*a[1]+3*v*v*u*b[1]+3*v*u*u*c[1]+u**3*d[1]))
    line(draw,path,color,width)
    return path


def what_cube(draw,x,y,mission=False):
    color=GREEN
    pts=[(x,y-38),(x+35,y-20),(x+35,y+17),(x,y+35),(x-35,y+17),(x-35,y-20)]
    draw.polygon(pts,fill='#123b2e')
    draw.polygon([pts[0],pts[1],(x,y-2),pts[5]],fill='#34314e' if mission else '#246544')
    line(draw,pts+[pts[0]],PURPLE if mission else color,2)
    line(draw,[pts[5],(x,y-2),pts[1]],color,2)
    line(draw,[(x,y-2),(x,y+35)],color,2)
    if mission:
        line(draw,[(x-8,y-20),(x+8,y-20)],PURPLE,2)
        line(draw,[(x,y-28),(x,y-12)],PURPLE,2)


def what_scene(draw,t,scene):
    """A compact web of concepts, not an illustrative deployment inventory."""
    faint=blend(NAVY,CYAN,.29 if scene==0 else .42)
    # Cross-links give the concepts a connected-web silhouette, rather than a stack.
    curves=[
        [(783,223),(815,162),(868,151),(908,174)],
        [(989,176),(1031,156),(1070,163),(1109,183)],
        [(1183,249),(1215,293),(1224,341),(1174,397)],
        [(1136,442),(1119,485),(1100,508),(1084,526)],
        [(1015,554),(961,587),(906,576),(866,551)],
        [(795,524),(749,514),(721,474),(724,430)],
        [(725,368),(695,326),(704,276),(735,247)],
        [(784,264),(850,299),(1016,445),(1035,497)],
        [(925,208),(916,316),(857,417),(842,497)],
        [(754,390),(891,321),(1033,313),(1131,407)],
    ]
    paths=[what_curve(draw,edge,faint,1) for edge in curves]
    # A few short communication cues: movement carries connection, not alarm.
    if scene>=1:
        progress=clamp(((t%6)-.7)/3.2)
        if 0<progress<1:
            for index in (1,4,7):
                x,y=point_on_path(paths[index],progress)
                draw.ellipse((x-3,y-3,x+3,y+3),fill=CYAN)
    for edge in [[(793,264),(839,286),(862,318),(894,341)],
                 [(1134,412),(1072,405),(1042,382),(1010,371)],
                 [(850,502),(876,456),(907,428),(926,412)]]:
        what_curve(draw,edge,blend(NAVY,TEAL,.35),1)

    # Familiar concept marks; names replace inventory identities/counts.
    entity_device(draw,745,251,'D1',.84,False)
    entity_device(draw,786,268,'D2',.66,False)
    label(draw,(760,292),'Devices',ORANGE,18,True,'mm')

    draw.rounded_rectangle((904,153,990,207),radius=7,fill='#153b50',outline=BLUE,width=2)
    draw.rounded_rectangle((915,164,931,178),radius=3,outline=BLUE,width=2)
    for yy,length in [(167,37),(179,37),(191,58)]:line(draw,[(941 if yy<190 else 919,yy),(941+length if yy<190 else 919+length,yy)],BLUE,2)
    label(draw,(947,230),'Software',BLUE,18,True,'mm')

    red='#ff958b'
    label(draw,(1145,161),'Findings',red,18,True,'mm')
    draw.rounded_rectangle((1065,183,1225,246),radius=10,fill='#3a282b',outline=red,width=2)
    label(draw,(1145,202),'CVE-2021-44228',red,14,True,'mm')
    label(draw,(1145,226),'CVE-2022-3602',red,14,True,'mm')
    label(draw,(1145,263),'Example associations',MUTED,12,False,'mm')

    network=[(1157,391),(1125,433),(1190,433)]
    line(draw,network+[network[0]],CYAN,2)
    for x,y in network:draw.rounded_rectangle((x-10,y-10,x+10,y+10),radius=5,fill='#153b50',outline=CYAN,width=2)
    label(draw,(1157,469),'Networks',CYAN,18,True,'mm')

    what_cube(draw,1050,535)
    label(draw,(1050,592),'ICT systems',GREEN,18,True,'mm')
    what_cube(draw,830,535,True)
    label(draw,(830,592),'Mission services',PURPLE,18,True,'mm')

    # Business services belong in the same context as mission services.
    what_curve(draw,[(1152,330),(1117,363),(1067,364),(1031,368)],blend(NAVY,PURPLE,.5),1)
    draw.rounded_rectangle((1124,295,1178,330),radius=6,fill='#282d48',outline=PURPLE,width=2)
    draw.rounded_rectangle((1140,286,1162,300),radius=3,outline=PURPLE,width=2)
    line(draw,[(1125,307),(1177,307)],PURPLE,1)
    label(draw,(1151,352),'Business services',PURPLE,17,True,'mm')

    dashed_round_rect(draw,(694,369,756,431),12,AMBER,2)
    label(draw,(725,400),'?',AMBER,38,False,'mm')
    label(draw,(725,459),'Unknowns',AMBER,18,True,'mm')

    # The platform is a lens on recorded context, not another device on the network.
    draw.rounded_rectangle((861,327,1031,412),radius=25,fill=NAVY,outline=TEAL if scene>=2 else '#31515b',width=2)
    label(draw,(946,356),'TSAAT',TEAL,31,True,'mm')
    label(draw,(946,389),'Context aware',MUTED,17,False,'mm')
    label(draw,(947,116),'ONE TERRAIN. MANY QUESTIONS.',TEAL,18,True,'mm')
    label(draw,(947,637),'CONCEPTUAL VIEW / CVE CODES ARE EXAMPLES',MUTED,12,True,'mm')


TOPOLOGY_NETWORKS = [
    ('Operations', 'A', ['D1','D2','D7','D8','D9','D10']),
    ('Enterprise', 'B', ['D3','D4','D11','D12','D13','D14']),
    ('Support', 'C', ['D5','D6','D15','D16','D17','D18'])]
TOPOLOGY_SOFTWARE = {'D1','D7','D3','D11','D5','D15'}


def terrain_scene(draw,t,scene,theme,finding=None,impact=None):
    """The same 18-CI, three-network topology used by the interactive overview."""
    finding_system=next((system for _,system,members in TOPOLOGY_NETWORKS if finding in members),None)
    active_systems=impact['systems'] if impact else []
    heading=impact['title'] if impact else 'FINDING F-01 / DEVICE '+finding if finding else 'AN ILLUSTRATIVE CYBER TERRAIN'
    label(draw,(957,118),heading,AMBER if finding or impact else TEAL,18,True,'mm')
    services=[('Mission','A',750),('Mission','B',888),('Business','A',1026),('Business','B',1164)]
    system_x={'A':772,'B':956,'C':1140}
    # Recorded support edges remain distinct from moving communication paths.
    dependencies=[('B',750,'Mission'),('C',750,'Mission'),('C',888,'Mission'),('A',1026,'Business'),('A',1164,'Business'),('B',1164,'Business')]
    for index,(system,x,kind) in enumerate(dependencies):
        bend=232+(index%3)*9
        tone=PURPLE if kind=='Mission' else '#efb8dc'
        strength=(1 if system==finding_system and scene>=2 else .22) if finding else (.85 if scene in (0,3) else .38)
        if impact:strength=1 if system in active_systems else .22
        line(draw,[(system_x[system],273),(system_x[system],bend),(x,bend),(x,212)],blend(NAVY,tone,strength),3 if (finding or impact) and strength==1 else 2)
    for kind,identity,x in services:
        tone=PURPLE if kind=='Mission' else '#efb8dc'
        color=tone if scene in (0,3) else blend(NAVY,tone,.55)
        if finding:
            related=any(system==finding_system and service_x==x for system,service_x,_ in dependencies)
            color=tone if related and scene>=2 else blend(NAVY,tone,.28)
        if impact:color=tone if any(system in active_systems and service_x==x for system,service_x,_ in dependencies) else blend(NAVY,tone,.28)
        draw.rounded_rectangle((x-51,158,x+51,212),radius=8,fill='#282d48',outline=color,width=2)
        label(draw,(x,175 if identity else 185),kind+' service',color,14,True,'mm')
        if identity:label(draw,(x,198),identity,color,21,True,'mm')
    points={}
    for index,(network,system,members) in enumerate(TOPOLOGY_NETWORKS):
        x=system_x[system]
        system_color=GREEN if scene in (0,2,3) else blend(NAVY,GREEN,.6)
        if finding:system_color=GREEN if system==finding_system and scene>=2 else blend(NAVY,GREEN,.28)
        if impact:system_color=GREEN if system in active_systems else blend(NAVY,GREEN,.28)
        draw.rounded_rectangle((x-72,273,x+72,315),radius=8,fill='#123b2e',outline=system_color,width=2)
        label(draw,(x,293),'System '+system,system_color,21,True,'mm')
        line(draw,[(x,316),(x,347)],system_color,2)
        draw.rounded_rectangle((x-87,347,x+87,609),radius=12,fill='#102633',outline=BLUE if scene==2 else '#365969',width=2 if scene==2 else 1)
        label(draw,(x,366),network,BLUE,18,True,'mm')
        label(draw,(x,388),'network',MUTED,16,False,'mm')
        for j,identity in enumerate(members):
            points[identity]=(x-55+(j%3)*55,449+(j//3)*118) if impact else (x-42+(j%2)*80,449+(j//2)*66)
        edges=[(0,1),(1,2),(0,3),(1,4),(2,5),(3,4),(4,5)] if impact else [(0,1),(0,2),(1,3),(2,3),(2,4),(3,5)]
        for ai,bi in edges:
            a,b=members[ai],members[bi]
            pa,pb=points[a],points[b]
            route(draw,[(pa[0],pa[1]-17),(pb[0],pb[1]-17)],t,CYAN,2)
    # Cross-network paths make the shared terrain explicit.
    if impact:
        route(draw,[(772,347),(772,332),(956,332),(956,347)],t,CYAN,2)
        route(draw,[(956,347),(956,332),(1140,332),(1140,347)],t,CYAN,2)
    else:
        for a,b in [('D2','D3'),('D4','D5')]:
            pa,pb=points[a],points[b]
            route(draw,[(pa[0],pa[1]-17),(pb[0],pb[1]-17)],t,YELLOW,2)
    for identity,(x,y) in points.items():
        entity_device(draw,x,y,identity,.64,True,False,identity in TOPOLOGY_SOFTWARE)
    if impact:
        if impact['issue']=='link':
            a,b=points['D7'],points['D3'];mid=(a[0]+b[0])/2;y=a[1]-17
            line(draw,[(a[0]+18,y),(mid-13,y)],YELLOW,3)
            line(draw,[(mid+13,y),(b[0]-18,y)],YELLOW,3)
            draw.ellipse((mid-9,y-9,mid+9,y+9),fill='#3d3522',outline=YELLOW,width=2)
            label(draw,(mid,y),'!',YELLOW,16,True,'mm')
            for identity,system in [('D7','A'),('D3','B')]:
                x,dy=points[identity];sx=system_x[system]
                line(draw,[(x-18,dy-22),(x-18,409),(sx-82,409),(sx-82,332),(sx,332),(sx,315)],GREEN,2)
        if impact['issue']=='device':
            x,y=points[impact['device']];sx=system_x[active_systems[0]]
            line(draw,[(x-18,y-22),(sx-82,y-22),(sx-82,332),(sx,332),(sx,315)],GREEN,3)
            draw.ellipse((x-33,y-48,x-9,y-24),fill='#572d2e',outline='#ff958b',width=2)
            label(draw,(x-21,y-36),'!','#ffe4dc',20,True,'mm')
        caption=impact['caption']
    elif finding:
        x,y=points[finding]
        if scene>=2:
            sx=system_x[finding_system]
            line(draw,[(x-18,y-22),(sx-82,y-22),(sx-82,332),(sx,332),(sx,315)],GREEN,3)
        draw.ellipse((x-33,y-48,x-9,y-24),fill='#572d2e',outline='#ff958b',width=2)
        label(draw,(x-21,y-36),'!','#ffe4dc',20,True,'mm')
        caption=['F-01 IS A REPORTED SOFTWARE FINDING','THE SAME DEVICE IN THE SAME CYBER TERRAIN','RECORDED DEPENDENCIES / IMPACT TO VALIDATE','D3 > SYSTEM B > MISSION A + BUSINESS B'][scene]
    else:caption=['18 CIs / 3 NETWORKS / 4 SERVICES','BLUE SW TILES MARK INSTALLED SOFTWARE','COMMUNICATION + RECORDED MEMBERSHIP','MISSION AND BUSINESS DEPENDENCIES'][scene]
    label(draw,(957,631),caption,MUTED,14,True,'mm')


def timeline_scene(draw,t,scene,phase):
    dates=['2019','Q3 2022','2023-24','2024-25','Q1 2026','JAN 2027']
    x0,x1=720,1192
    line(draw,[(x0,377),(x1,377)],'#254453',3)
    progress=max(0,scene-1)+ease(phase)*min(scene,1)
    line(draw,[(x0,377),(x0+(x1-x0)*min(progress,5)/5,377)],TEAL,3)
    for i,date in enumerate(dates):
        x=x0+(x1-x0)*i/5
        col=AMBER if i==5 else TEAL if i<=scene else '#426070'
        r=10 if i==scene else 6
        draw.ellipse((x-r,377-r,x+r,377+r),fill=col)
        label(draw,(x,415+(i%2)*27),date,col,14,True,'mm')
    label(draw,(947,255),['DISCOVER','MODEL','ASSESS','SCALE','SHARE','DESIGN'][scene],WHITE,45,True,'mm')
    if scene==2:
        label(draw,(835,530),'~87',GREEN,44,True,'mm');label(draw,(835,577),'CRITICAL SYSTEMS',MUTED,14,True,'mm')
        label(draw,(1065,530),'28',AMBER,44,True,'mm');label(draw,(1065,577),'COMPLIANCE QUESTIONS',MUTED,13,True,'mm')
    elif scene==3:
        label(draw,(947,530),'~3,000',GREEN,44,True,'mm');label(draw,(947,577),'ICT SYSTEMS IN OMWOW MODELLING',MUTED,14,True,'mm')
    elif scene==5:
        draw.rounded_rectangle((838,505,1056,549),radius=22,outline=AMBER,width=2)
        label(draw,(947,527),'PLANNED DELIVERY',AMBER,14,True,'mm')
    else:label(draw,(947,540),['DISCOVERY FOUNDATION','MODELLING + PROCESS','ASSESSMENT','INVENTORY AT SCALE','VISIBILITY OF THE TERRAIN','NEXT CHAPTER'][scene],TEAL,16,True,'mm')


def vulnerabilities_scene(draw,t,scene):
    terrain_scene(draw,t,scene,None,finding='D3')


def dashed_round_rect(draw,box,radius,color,width=2):
    x0,y0,x1,y1=box
    draw.rounded_rectangle(box,radius=radius,fill='#29323a')
    for x in range(int(x0+radius),int(x1-radius),11):
        for y in (y0,y1):line(draw,[(x,y),(min(x+6,x1-radius),y)],color,width)
    for y in range(int(y0+radius),int(y1-radius),11):
        for x in (x0,x1):line(draw,[(x,y),(x,min(y+6,y1-radius))],color,width)
    for bounds,start in [((x0,y0,x0+2*radius,y0+2*radius),180),((x1-2*radius,y0,x1,y0+2*radius),270),((x1-2*radius,y1-2*radius,x1,y1),0),((x0,y1-2*radius,x0+2*radius,y1),90)]:
        draw.arc(bounds,start,start+34,fill=color,width=width)
        draw.arc(bounds,start+55,start+90,fill=color,width=width)


def shadow_device(draw,x,y,identity,router=False,server=False,observer=False):
    if observer:draw.ellipse((x-29,y-29,x+29,y+29),outline=CYAN,width=2)
    draw.ellipse((x-21,y-21,x+21,y+21),fill='#302b27',outline=ORANGE,width=2)
    if router:
        draw.rectangle((x-14,y-7,x+14,y+8),outline=ORANGE,width=2)
        line(draw,[(x-9,y-12),(x+9,y-12),(x+5,y-16)],ORANGE,2)
        line(draw,[(x+9,y+13),(x-9,y+13),(x-5,y+17)],ORANGE,2)
    elif server:
        draw.rounded_rectangle((x-10,y-15,x+10,y+15),radius=2,outline=ORANGE,width=2)
        for dy in (-5,5):line(draw,[(x-10,y+dy),(x+10,y+dy)],ORANGE,1)
        draw.rounded_rectangle((x+13,y-36,x+43,y-15),radius=4,fill='#153b50',outline=BLUE,width=1)
        label(draw,(x+28,y-25),'SW',BLUE,12,True,'mm')
    else:
        draw.rectangle((x-14,y-10,x+14,y+8),outline=ORANGE,width=2)
        line(draw,[(x,y+8),(x,y+14),(x-8,y+14),(x+8,y+14)],ORANGE,2)
    label(draw,(x,y+43),identity,ORANGE,18,True,'mm')


def shadow_scene(draw,t,scene):
    if scene==3:
        label(draw,(947,135),'KEEP THE QUESTIONS DISTINCT',TEAL,20,True,'mm')
        for i,(title,question) in enumerate([
            ('Endpoint or network observation','Which address has no matching record?'),
            ('CMDB discovery scan','Which detected address has no device type?'),
            ('Investigation and follow-up','What is it, who owns it, and what is the evidence?')]):
            y=225+i*132
            draw.rounded_rectangle((705,y-43,1210,y+54),radius=12,fill='#102633',outline=CYAN if i<2 else AMBER,width=2)
            label(draw,(729,y-24),title,BLUE if i<2 else AMBER,22,True)
            paragraph(draw,(729,y+12),question,455,18,MUTED,24)
        label(draw,(947,625),'UNKNOWN DOES NOT MEAN MALICIOUS',MUTED,15,True,'mm')
        return
    scan=scene==2
    observer='ND1' if scene==1 else 'D3'
    address=['192.0.2.87','198.51.100.64','192.0.2.47'][scene]
    label(draw,(947,125),['ENDPOINT OBSERVATION','NETWORK DEVICE COMMUNICATION','CMDB IP-RANGE DISCOVERY'][scene],TEAL,19,True,'mm')
    if scan:
        draw.rounded_rectangle((705,185,1001,281),radius=10,fill='#153340',outline=BLUE,width=2)
        label(draw,(853,218),'CMDB discovery',BLUE,26,True,'mm')
        label(draw,(853,253),'Scan configured IP range',MUTED,18,False,'mm')
        route(draw,[(853,282),(853,340)],t,CYAN,2)
        draw.rounded_rectangle((705,340,1001,571),radius=12,fill='#102633',outline='#365969',width=1)
        label(draw,(853,370),'192.0.2.1 - 192.0.2.254',BLUE,18,True,'mm')
        label(draw,(853,402),'Examples classified by the scan',MUTED,16,False,'mm')
        for i,kind in enumerate(['Server','Computer','Printer','Router']):
            x=779+(i%2)*147;y=455+(i//2)*65
            draw.rounded_rectangle((x-62,y-22,x+62,y+22),radius=7,fill='#17352c',outline=GREEN,width=1)
            label(draw,(x,y),kind,GREEN,19,True,'mm')
        path=[(1002,233),(1040,233),(1040,300),(1068,300)]
    else:
        draw.rounded_rectangle((695,190,1005,570),radius=12,fill='#102633',outline='#365969',width=1)
        label(draw,(850,219),'KNOWN NETWORK RECORDS',BLUE,17,True,'mm')
        label(draw,(850,247),'ND1: known network device' if scene==1 else 'D3: known endpoint in System B',MUTED,16,False,'mm')
        points={'D1':(745,346),'D2':(745,478),observer:(850,346),'D4':(850,478),'D5':(955,346),'D6':(955,478)}
        for a,b in [('D1',observer),(observer,'D5'),('D1','D2'),(observer,'D4'),('D5','D6'),('D2','D4'),('D4','D6')]:route(draw,[points[a],points[b]],t,CYAN,1)
        for identity,(x,y) in points.items():shadow_device(draw,x,y,identity,identity=='ND1',identity in ('D1','D3','D5'),identity==observer)
        path=[(850,317),(850,284),(1040,284),(1040,300),(1068,300)]
    route(draw,path,t,CYAN,2)
    label(draw,(1135,206),'Discovery result' if scan else 'Observed address',BLUE,18,True,'mm')
    dashed_round_rect(draw,(1070,250,1200,350),13,AMBER,2)
    label(draw,(1135,300),'?',AMBER,55,False,'mm')
    label(draw,(1135,389),'Unclassified' if scan else 'Unmatched',AMBER,23,True,'mm')
    label(draw,(1135,420),address,AMBER,18,True,'mm')
    label(draw,(1135,453),'Device type unknown' if scan else 'Identity not matched',MUTED,17,False,'mm')
    if scan:
        label(draw,(1135,497),'Server? Computer?',MUTED,16,False,'mm')
        label(draw,(1135,522),'Printer? Router?',MUTED,16,False,'mm')
    label(draw,(947,621),'DETECTED ADDRESS / CLASSIFICATION TO RESOLVE' if scan else observer+' IS KNOWN / THE OTHER ADDRESS IS UNMATCHED',MUTED,14,True,'mm')


def services_scene(draw,t,scene):
    if scene==3:
        label(draw,(947,135),'SERVICES TO REVIEW / IMPACT TO VALIDATE',TEAL,19,True,'mm')
        for i,(title,detail) in enumerate([
            ('Confirm the dependency','Check the records and responsible owner.'),
            ('Check alternative paths','Consider other systems and network routes.'),
            ('Validate service state','Establish the actual operational impact.')]):
            y=225+i*132
            draw.rounded_rectangle((705,y-43,1210,y+54),radius=12,fill='#102633',outline=PURPLE if i<2 else TEAL,width=2)
            label(draw,(729,y-24),title,WHITE,23,True)
            paragraph(draw,(729,y+12),detail,455,19,MUTED,25)
        label(draw,(947,625),'A HIGHLIGHT IS NOT A CONFIRMED OUTAGE',MUTED,15,True,'mm')
        return
    scenarios=[
        {'systems':['A'],'issue':'device','device':'D1','title':'DEVICE D1 / ICT SYSTEM A','caption':'REVIEW BUSINESS SERVICES A + B'},
        {'systems':['C'],'issue':'device','device':'D5','title':'DEVICE D5 / ICT SYSTEM C','caption':'REVIEW MISSION SERVICES A + B'},
        {'systems':['A','B'],'issue':'link','title':'D7-D3 DEVICE LINK UNAVAILABLE','caption':'REVIEW BUSINESS A + B AND MISSION A'}]
    terrain_scene(draw,t,scene,None,impact=scenarios[scene])


def reporting_scene(draw,t,scene):
    local=t-scene*8
    stage=min(3,int(local/2));color=[TEAL,BLUE,PURPLE][scene]
    def panel(box,outline='#365563'):
        draw.rounded_rectangle(box,radius=10,fill='#102633',outline=outline,width=2)
    def flight(identity,points,start,duration=1.4,delay=0):
        progress=clamp((local-start-delay)/duration)
        if 0<progress<1:
            x,y=point_on_path(points,ease(progress))
            draw.rounded_rectangle((x-21,y-15,x+21,y+15),radius=5,fill='#21453e',outline=color,width=2)
            label(draw,(x,y),identity,WHITE,18,True,'mm')
    def trace(points,progress):
        line(draw,points,blend(NAVY,color,.25),2)
        if progress>0:
            end=point_on_path(points,clamp(progress))
            line(draw,[points[0],end],color,3)
    panel((700,145,1195,280))
    label(draw,(947,167),'SELECTED TERRAIN / SYSTEM C',GREEN,19,True,'mm')
    for identity,x in [('D5',845),('D6',1050)]:
        ink=blend(NAVY,ORANGE,.3) if identity=='D6' and scene!=1 and stage>0 else ORANGE
        draw.ellipse((x-25,192,x+25,242),fill='#302b27',outline=ink,width=2)
        draw.rectangle((x-12,202,x+12,231),outline=ink,width=2)
        for y in (210,219):line(draw,[(x-8,y),(x+8,y)],ink,2)
        label(draw,(x,260),identity,ink,20,True,'mm')
        if identity=='D5':
            draw.rounded_rectangle((x+15,183,x+47,203),radius=4,fill='#173e51',outline=BLUE)
            label(draw,(x+31,193),'SW',BLUE,12,True,'mm')
    panel((700,315,1195,420),color if stage>0 else '#365563')
    if scene==2:
        panel((737,343,880,392),GREEN)
        label(draw,(809,368),'System C',GREEN,21,True,'mm')
        for i,y in enumerate((342,393)):
            trace([(880,368),(1014,y)],(local-2.35-i*.25)/1.1)
            panel((1014,y-20,1177,y+20),PURPLE)
            label(draw,(1095,y),'Mission service '+chr(65+i),PURPLE,16,True,'mm')
    else:
        label(draw,(947,349),'Explorer search: D5' if scene==0 else 'Keep the header scope',color,25,True,'mm')
        label(draw,(947,389),'Keep D5; D6 does not match' if scene==0 else 'D5 + D6 / search does not narrow this PDF',MUTED,18,False,'mm')
    line(draw,[(947,281),(947,314)],blend(NAVY,color,.5),2)
    line(draw,[(947,421),(947,454)],blend(NAVY,color,.5),2)
    panel((700,455,1195,603),color)
    label(draw,(947,480),['FILTERED EXCEL','BRIEFING PDF','IMPACT PDF'][scene],color,23,True,'mm')
    build=clamp((local-4)/1.7)
    if build>0:
        if scene==0:
            draw.rounded_rectangle((730,513,730+435*ease(build),555),radius=5,fill='#1b3c47')
            if build>.4:label(draw,(947,534),'D5       System C       SW',WHITE,23,True,'mm')
        elif scene==1:
            label(draw,(947,529),str(round(2*build))+' devices in scope',WHITE,29,True,'mm')
            draw.rounded_rectangle((780,554,780+333*ease(build),565),radius=4,fill=BLUE)
        else:
            label(draw,(947,524),'D5 > System C > Mission A + B',WHITE,21,True,'mm')
            for i in range(3):
                if build>(i*.2):line(draw,[(782,546+i*10),(782+(330-i*45)*ease(build),546+i*10)],PURPLE,3)
        if build>.6:label(draw,(947,583),['Every matching row, across all pages','Header scope + loaded snapshot','Full traced graph + supporting evidence'][scene],MUTED,17,False,'mm')
    else:label(draw,(947,550),'The output builds here',MUTED,21,False,'mm')
    for i,(identity,x) in enumerate([('D5',845),('D6',1050)]):
        if scene==1 or identity=='D5':
            flight(identity,[(x,260),(809 if scene==2 else 947,368)],2,delay=i*.25)
            flight(identity,[(1095 if scene==2 else 947,393),(947,534)],4,delay=i*.25)
    label(draw,(947,628),['1 / SELECT TERRAIN','2 / '+['APPLY SEARCH','KEEP SCOPE','TRACE RELATIONSHIPS'][scene],'3 / BUILD THE OUTPUT','4 / READY TO SHARE'][stage],color,15,True,'mm')


def benefits_scene(draw,t,scene):
    entity_device(draw,752,394,'D3',1.3,True,scene==0)
    entity_system(draw,947,380,'B',.9,scene==1)
    report_symbol(draw,1152,358,'Report',TEAL)
    route(draw,[(804,365),(884,365)],t,CYAN)
    route(draw,[(1005,365),(1123,365)],t,TEAL)
    for x,title in [(752,'SEE'),(947,'CONNECT'),(1152,'SHARE')]:label(draw,(x,525),title,WHITE,26,True,'mm')
    label(draw,(947,601),'A CLEARER PICTURE. A BETTER CONVERSATION.',MUTED,15,True,'mm')


def background():
    im=Image.new('RGB',(WIDTH,HEIGHT),NAVY)
    d=ImageDraw.Draw(im)
    # Quiet space keeps attention on the objects and the relationship being told.
    for y in range(HEIGHT):
        d.line((650,y,1279,y),fill=blend(NAVY,'#10343b',max(0,1-abs(y-350)/550)*.18))
    d.line((60,91,1220,91),fill='#29414d',width=1)
    d.line((60,650,1220,650),fill='#29414d',width=1)
    return im


BACKGROUND=background()


def render(section,frame):
    film=FILMS[section];seconds=film['seconds'];t=frame/FPS
    scene=min(int(t/seconds),len(film['scenes'])-1);local=t-scene*seconds
    headline,subhead,body=film['scenes'][scene]
    im=BACKGROUND.copy();d=ImageDraw.Draw(im)
    col=AMBER if section in ('origins','shadow','vulnerabilities') else TEAL
    d.rectangle((60,40,80,43),fill=col)
    label(d,(94,30),'TSAAT / OVERVIEW',col,15,True)
    label(d,(1220,32),film['title'].upper(),MUTED,14,True,'ra')
    slide=round((1-ease(local/.55))*18)
    textlayer=Image.new('RGBA',(WIDTH,HEIGHT));td=ImageDraw.Draw(textlayer)
    label(td,(60,131+slide),f'{film["number"]}   /   {scene+1:02d}',col,16,True)
    max_width=560
    title_size=61 if section!='origins' else 71
    title_lines=headline.split('\n')
    while max(td.textlength(row,font=font(title_size,True)) for row in title_lines)>max_width:title_size-=1
    y=179+slide
    for n,row in enumerate(title_lines):
        line_slide=round((1-ease((local-.07*n)/.5))*7)
        label(td,(60,y+line_slide),row,WHITE,title_size,True)
        y+=title_size+11
    y=max(y+23,365)
    label(td,(60,y),subhead,col,21,True)
    paragraph(td,(60,y+48),body,540,23,MUTED,34)
    alpha=ease(local/.45)
    if alpha<1:textlayer.putalpha(textlayer.getchannel('A').point(lambda p:round(p*alpha)))
    im.paste(textlayer,(0,0),textlayer)
    d=ImageDraw.Draw(im)
    if section=='what':what_scene(d,t,scene)
    elif section=='terrain':terrain_scene(d,t,scene,section)
    elif section=='origins':timeline_scene(d,t,scene,local)
    elif section=='vulnerabilities':vulnerabilities_scene(d,t,scene)
    elif section=='shadow':shadow_scene(d,t,scene)
    elif section=='services':services_scene(d,t,scene)
    elif section=='reporting':reporting_scene(d,t,scene)
    elif section=='benefits':benefits_scene(d,t,scene)
    count=len(film['scenes']);bar_width=(1160-8*(count-1))/count
    for i in range(count):
        x=60+i*(bar_width+8)
        d.rounded_rectangle((x,650,x+bar_width,653),radius=1,fill='#29414d')
        progress=1 if i<scene else clamp(local/seconds) if i==scene else 0
        if progress:d.rounded_rectangle((x,650,x+bar_width*progress,653),radius=1,fill=col)
    label(d,(60,678),film['label'],MUTED,14)
    label(d,(1220,678),f'{scene+1:02d} / {count:02d}     TSAAT',col,14,True,'ra')
    return im


def timestamp(value):
    return f'00:{int(value)//60:02d}:{value%60:06.3f}'


def encoder_path(requested=None):
    if requested:return str(requested)
    found=shutil.which('ffmpeg')
    if found:return found
    sys.path.insert(0,str(ROOT/'build/video-tools'))
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def render_film(section,encoder,preview=False):
    film=FILMS[section];duration=film['seconds']*len(film['scenes'])
    destination=ROOT/'guide'/f'overview-{section}.mp4'
    poster=ROOT/'assets'/f'overview-{section}-poster.jpg'
    vtt=ROOT/'assets'/f'overview-{section}.vtt'
    staging=ROOT/'build/overview-films';staging.mkdir(parents=True,exist_ok=True)
    poster_image=render(section,round(2*FPS));poster_image.save(poster,quality=91,optimize=True)
    # Storyboard sheets are retained as local QA artifacts, not distribution files.
    sheet=Image.new('RGB',(640*2,360*math.ceil(len(film['scenes'])/2)),NAVY)
    for i in range(len(film['scenes'])):
        still=render(section,round((i*film['seconds']+2)*FPS))
        sheet.paste(still.resize((640,360),Image.Resampling.LANCZOS),((i%2)*640,(i//2)*360))
    sheet.save(staging/f'{section}-storyboard.jpg',quality=93)
    captions=['WEBVTT','']
    for i,(headline,subhead,body) in enumerate(film['scenes']):
        captions += [f'{timestamp(i*film["seconds"])} --> {timestamp((i+1)*film["seconds"])}',body,'']
    vtt.write_text('\n'.join(captions),encoding='utf-8')
    if preview:return
    pending=staging/f'overview-{section}.mp4'
    command=[encoder,'-y','-loglevel','error','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{WIDTH}x{HEIGHT}','-framerate',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','21','-threads','2','-pix_fmt','yuv420p','-movflags','+faststart',str(pending)]
    process=subprocess.Popen(command,stdin=subprocess.PIPE)
    try:
        for frame in range(round(duration*FPS)):
            process.stdin.write(render(section,frame).tobytes())
    finally:
        process.stdin.close()
    if process.wait()!=0:raise RuntimeError('FFmpeg encoding failed: '+section)
    # Decode the whole result to detect corruption before replacing a shipped film.
    subprocess.run([encoder,'-v','error','-i',str(pending),'-f','null','-'],check=True,stdout=subprocess.DEVNULL)
    shutil.copyfile(pending,destination)
    result={'file':destination.name,'poster':str(poster.relative_to(ROOT)).replace('\\','/'),'captions':str(vtt.relative_to(ROOT)).replace('\\','/'),'duration':duration,'label':film['label'],'width':WIDTH,'height':HEIGHT,'fps':FPS,'codec':'h264','rendererSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'audio':'none; caption-led motion graphics','sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),'bytes':destination.stat().st_size,'scenes':[{'start':i*film['seconds'],'end':(i+1)*film['seconds'],'headline':s[0].replace('\n',' '),'subtitle':s[1],'body':s[2]} for i,s in enumerate(film['scenes'])]}
    print(f'{section}: {duration}s, {destination.stat().st_size:,} bytes, complete decode passed',flush=True)
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sections',nargs='*',metavar='SECTION')
    parser.add_argument('--ffmpeg',type=Path)
    parser.add_argument('--preview-only',action='store_true',help='Create posters and storyboard sheets without encoding videos')
    args=parser.parse_args();sections=args.sections or list(FILMS)
    if any(s not in FILMS for s in sections):parser.error('Unknown section; choose: '+', '.join(FILMS))
    manifest_path=ROOT/'assets/overview-videos.json'
    existing=json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    manifest={section: existing[section] for section in FILMS if section in existing}
    encoder=encoder_path(args.ffmpeg) if not args.preview_only else None
    for section in sections:
        result=render_film(section,encoder,args.preview_only)
        if result:
            manifest[section]=result
            manifest_path.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    if not args.preview_only:
        print('Built '+str(len(sections))+' original overview films.',flush=True)


if __name__=='__main__':main()

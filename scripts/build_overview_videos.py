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
 'understand': {
  'title':'How TSAAT helps you understand', 'label':'Turn detail into understanding', 'seconds':6,
  'scenes':[
   ['Choose your\nview.', 'Start with the question', 'Select the cyber terrain and snapshot you need before interpreting a result.'],
   ['Find the\npattern.', 'Governance', 'Read summaries to see recorded patterns, missing details and discovery gaps.'],
   ['Follow the\nevidence.', 'Discovery', 'Explore the underlying records, open details and follow recorded relationships.'],
   ['Explain what\nyou found.', 'A shared basis for discussion', 'Use reports and exports to support a focused conversation about the evidence.']
  ]},
 'vulnerabilities': {
  'title':'Security vulnerabilities', 'label':'A signal to investigate', 'seconds':6,
  'scenes':[
   ['A finding is\na starting point.', 'Security vulnerabilities', 'A vulnerability observation records a potential weakness associated with a device or software.'],
   ['Add the\ncontext.', 'Which device? Which software?', 'Examine the affected records, recorded CVE details and the source that reported the observation.'],
   ['Separate\nsignal from proof.', 'Observation is not exploitation', 'A recorded finding is not proof that a weakness is exploitable or has been exploited.'],
   ['Investigate.\nThen prioritise.', 'Evidence supports judgement', 'Combine recorded evidence with system context and validation to inform the next step.']
  ]},
 'shadow': {
  'title':'Shadow IT', 'label':'Make the unknown visible', 'seconds':6,
  'scenes':[
   ['What is\nmissing?', 'Shadow IT', 'An unfamiliar address or device can reveal a gap between observed activity and known inventory.'],
   ['Keep the\nroles separate.', 'Observed device + reporting device', 'Distinguish the unknown device from the known device that reported seeing it.'],
   ['Unknown does\nnot mean hostile.', 'A lead to investigate', 'An unexplained record could reflect an inventory gap, an expected device or something requiring attention.'],
   ['Investigate\nthe gap.', 'Identify. Validate. Follow up.', 'Review the evidence and establish the device identity, owner and place in the terrain.']
  ]},
 'services': {
  'title':'Service impacts', 'label':'Trace what depends on what', 'seconds':6,
  'scenes':[
   ['Start with\nthe service.', 'What needs to keep working?', 'Mission services, business services and ICT services depend on systems, networks, software and devices working together.'],
   ['Trace the\ndependencies.', 'An illustrative dependency path', 'Follow recorded relationships to identify components that may support a service.'],
   ['Ask what else\ncould be affected.', 'Potential impact, not a prediction', 'A component issue may have wider implications. Recorded links help frame the investigation.'],
   ['Validate with\nthe owners.', 'Turn a connection into a conversation', 'Confirm dependencies and operational context with owners before drawing conclusions about service impact.']
  ]},
 'reporting': {
  'title':'Reporting and focused insights', 'label':'A focused answer. Context you can share.', 'seconds':6,
  'scenes':[
   ['Choose the\nanswer you need.', 'Records, a briefing, or service relationships', 'Choose filtered Excel for matching records, a briefing PDF for a scoped summary, or an impact PDF for traced relationships.'],
   ['Export the\nmatching records.', 'Filtered Excel', 'Explorer Excel exports include every row matching the selected scope and Explorer filters, across all pages.'],
   ['Brief the\nselected terrain.', 'Briefing PDF', 'Governance briefing PDFs use applied header scope and the loaded snapshot. Explorer search does not narrow the briefing.'],
   ['Show the\ntraced connections.', 'Impact PDF', 'Choose a starting CI or matching results in Topology Explorer. Export the full traced graph and supporting evidence, with the scope and snapshot.']
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
    'reporting', 'understand', 'benefits')}
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


def terrain_scene(draw,t,scene,theme):
    """The same 18-CI, three-network topology used by the interactive overview."""
    label(draw,(957,118),'AN ILLUSTRATIVE CYBER TERRAIN',TEAL,18,True,'mm')
    services=[('Mission','A',750),('Mission','B',888),('Business','A',1026),('Business','B',1164)]
    system_x={'A':772,'B':956,'C':1140}
    # Recorded support edges remain distinct from moving communication paths.
    dependencies=[('B',750,'Mission'),('C',750,'Mission'),('C',888,'Mission'),('A',1026,'Business'),('A',1164,'Business'),('B',1164,'Business')]
    for index,(system,x,kind) in enumerate(dependencies):
        bend=232+(index%3)*9
        tone=PURPLE if kind=='Mission' else '#efb8dc'
        line(draw,[(system_x[system],273),(system_x[system],bend),(x,bend),(x,212)],blend(NAVY,tone,.85 if scene in (0,3) else .38),2)
    for kind,identity,x in services:
        tone=PURPLE if kind=='Mission' else '#efb8dc'
        color=tone if scene in (0,3) else blend(NAVY,tone,.55)
        draw.rounded_rectangle((x-51,158,x+51,212),radius=8,fill='#282d48',outline=color,width=2)
        label(draw,(x,175 if identity else 185),kind+' service',color,14,True,'mm')
        if identity:label(draw,(x,198),identity,color,21,True,'mm')
    points={}
    for index,(network,system,members) in enumerate(TOPOLOGY_NETWORKS):
        x=system_x[system]
        system_color=GREEN if scene in (0,2,3) else blend(NAVY,GREEN,.6)
        draw.rounded_rectangle((x-72,273,x+72,315),radius=8,fill='#123b2e',outline=system_color,width=2)
        label(draw,(x,293),'System '+system,system_color,21,True,'mm')
        line(draw,[(x,316),(x,347)],system_color,2)
        draw.rounded_rectangle((x-87,347,x+87,609),radius=12,fill='#102633',outline=BLUE if scene==2 else '#365969',width=2 if scene==2 else 1)
        label(draw,(x,366),network,BLUE,18,True,'mm')
        label(draw,(x,388),'network',MUTED,16,False,'mm')
        for j,identity in enumerate(members):
            points[identity]=(x-42+(j%2)*80,449+(j//2)*66)
        for a,b in [(members[0],members[1]),(members[0],members[2]),(members[1],members[3]),(members[2],members[3]),(members[2],members[4]),(members[3],members[5])]:
            pa,pb=points[a],points[b]
            route(draw,[(pa[0],pa[1]-17),(pb[0],pb[1]-17)],t,CYAN,2)
    # Cross-network paths make the shared terrain explicit.
    for a,b in [('D2','D3'),('D4','D5')]:
        pa,pb=points[a],points[b]
        route(draw,[(pa[0],pa[1]-17),(pb[0],pb[1]-17)],t,YELLOW,2)
    for identity,(x,y) in points.items():
        entity_device(draw,x,y,identity,.64,True,False,identity in TOPOLOGY_SOFTWARE)
    label(draw,(957,631),['18 CIs / 3 NETWORKS / 4 SERVICES','BLUE SW TILES MARK INSTALLED SOFTWARE','COMMUNICATION + RECORDED MEMBERSHIP','MISSION AND BUSINESS DEPENDENCIES'][scene],MUTED,14,True,'mm')


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


def understand_scene(draw,t,scene):
    for i,identity in enumerate(['D1','D3','D5']):
        y=275+i*125
        entity_device(draw,746,y,identity,.85)
        route(draw,[(790,y-20),(868,377)],t,CYAN)
    draw.rounded_rectangle((865,335,961,420),radius=14,fill='#103740',outline=TEAL,width=2)
    label(draw,(913,377),'TSAAT',WHITE,23,True,'mm')
    for y,caption in [(275,'GOVERNANCE'),(478,'DISCOVERY')]:
        route(draw,[(962,377),(1011,377),(1011,y),(1080,y)],t,TEAL)
        draw.rounded_rectangle((1060,y-48,1212,y+48),radius=9,fill='#102633',outline=TEAL,width=2)
        label(draw,(1136,y-19),caption,WHITE,15,True,'mm')
        label(draw,(1136,y+14),'Summaries' if y==275 else 'Records',MUTED,19,False,'mm')
    label(draw,(947,606),'SCOPE  /  EVIDENCE  /  UNDERSTANDING',MUTED,16,True,'mm')


def vulnerabilities_scene(draw,t,scene):
    label(draw,(947,118),'RECORDED FINDING ON D3',AMBER,20,True,'mm')
    entity_landscape(draw,t,True,True,finding='D3')
    draw.rectangle((678,619,1225,644),fill=NAVY)
    label(draw,(947,632),'A FINDING NEEDS CONTEXT AND VALIDATION',MUTED,15,True,'mm')


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


def shadow_scene(draw,t,scene):
    entity_system(draw,795,214,'B',.75)
    points=network_points(385,105)
    draw.rounded_rectangle((710,310,1204,537),radius=12,fill='#102633',outline='#294553',width=1)
    network_paths(draw,points,t)
    # D3 is a known observer, marked by a static outline rather than a finding.
    draw.rounded_rectangle((915,320,994,409),radius=9,outline=ORANGE,width=2)
    for identity,(x,y) in points.items():entity_device(draw,x,y,identity,.86)
    x,y=1122,184
    dashed_round_rect(draw,(x-44,y-44,x+44,y+44),13,AMBER,2)
    label(draw,(x,y),'?',AMBER,46,False,'mm')
    label(draw,(x,256),'Unmatched address',AMBER,18,True,'mm')
    label(draw,(x,282),'Identity unknown',MUTED,17,False,'mm')
    route(draw,[(947,320),(947,300),(1222,300),(1222,184),(1166,184)],t,CYAN)
    label(draw,(947,576),'D3: REPORTING DEVICE',ORANGE,18,True,'mm')
    label(draw,(947,608),'OBSERVED COMMUNICATION / IDENTITY TO CHECK',MUTED,14,True,'mm')


def services_scene(draw,t,scene):
    label(draw,(947,118),'FOLLOW RECORDED DEPENDENCIES',PURPLE,18,True,'mm')
    entity_landscape(draw,t,True,False,'D3' if scene>=2 else None)
    if scene>=2:
        draw.rectangle((678,618,1225,642),fill=NAVY)
        label(draw,(947,630),'D3 > SYSTEM B > MISSION SERVICE A: INVESTIGATE',AMBER,14,True,'mm')


def reporting_scene(draw,t,scene):
    cx=947
    if scene==0:
        label(draw,(cx,168),'WHAT DO YOU NEED TO SHARE?',TEAL,21,True,'mm')
        for i,(question,output,color) in enumerate([
            ('The matching records','Filtered Excel',GREEN),
            ('A summary of the selected terrain','Briefing PDF',BLUE),
            ('The service dependency evidence','Impact PDF',PURPLE)]):
            y=238+i*125
            draw.rounded_rectangle((702,y-29,1192,y+68),radius=12,fill='#102633',outline=color,width=2)
            label(draw,(727,y-9),question,MUTED,19)
            label(draw,(727,y+24),output,color,26,True)
        label(draw,(cx,610),'CHOOSE THE OUTPUT THAT ANSWERS YOUR QUESTION',MUTED,14,True,'mm')
        return
    draw.rounded_rectangle((716,148,1180,226),radius=10,fill='#12343c',outline=GREEN,width=2)
    label(draw,(cx,173),'EXAMPLE SCOPE: SYSTEM C',GREEN,19,True,'mm')
    label(draw,(cx,203),'Security domains + loaded snapshot',MUTED,17,False,'mm')
    if scene==1:
        route(draw,[(cx,227),(cx,270)],t,TEAL)
        draw.rounded_rectangle((747,274,1147,331),radius=8,fill='#12313f',outline=BLUE,width=2)
        label(draw,(cx,302),'Explorer search: D5',BLUE,23,True,'mm')
        route(draw,[(cx,332),(cx,385)],t,TEAL)
        draw.rounded_rectangle((716,388,1180,550),radius=12,fill='#102633',outline=GREEN,width=2)
        label(draw,(cx,418),'FILTERED EXCEL',GREEN,23,True,'mm')
        label(draw,(cx,469),'D5',ORANGE,42,True,'mm')
        label(draw,(cx,520),'1 matching device record',MUTED,20,False,'mm')
        label(draw,(cx,602),'ALL MATCHING ROWS, ACROSS ALL PAGES',MUTED,15,True,'mm')
        return
    if scene==2:
        route(draw,[(cx,227),(cx,328)],t,BLUE)
        draw.rounded_rectangle((716,331,1180,528),radius=12,fill='#102633',outline=BLUE,width=2)
        label(draw,(cx,368),'BRIEFING PDF',BLUE,23,True,'mm')
        label(draw,(cx,427),'D5 + D6',ORANGE,39,True,'mm')
        label(draw,(cx,483),'2 devices in the selected scope',MUTED,20,False,'mm')
        label(draw,(cx,567),'Explorer search does not narrow this PDF.',MUTED,20,False,'mm')
        label(draw,(cx,610),'HEADER SCOPE + LOADED SNAPSHOT',MUTED,15,True,'mm')
        return
    label(draw,(cx,269),'IMPACT PDF / ILLUSTRATIVE TRACE',PURPLE,21,True,'mm')
    entity_device(draw,751,401,'D5',1.0)
    route(draw,[(786,372),(878,372)],t,PURPLE)
    draw.rounded_rectangle((880,339,1012,407),radius=10,fill='#123b2e',outline=GREEN,width=2)
    label(draw,(946,372),'System C',GREEN,23,True,'mm')
    for y,service in [(330,'A'),(446,'B')]:
        route(draw,[(1014,372),(1040,372),(1040,y),(1070,y)],t,PURPLE)
        entity_service(draw,1137,y,'Mission service '+service)
    draw.rounded_rectangle((716,518,1180,573),radius=8,fill='#102633',outline=PURPLE,width=2)
    label(draw,(cx,545),'Full traced graph + supporting evidence',PURPLE,20,True,'mm')
    label(draw,(cx,613),'STARTING CI + TRACE MODE + SCOPE + SNAPSHOT',MUTED,14,True,'mm')


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
    elif section=='understand':understand_scene(d,t,scene)
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

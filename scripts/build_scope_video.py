"""Record the actual practice lab and encode the offline scope walkthrough.

Requires installed Playwright + its FFmpeg recorder and an H.264 FFmpeg encoder.
Normal guide builds use the checked-in media without recording dependencies.
Use --reuse-recording to re-encode a verified capture from build/scope-recording.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

from build_guide import ROOT

CAPTURE = ROOT / 'build/scope-recording'
ASSETS = ROOT / 'assets'


def render_assets(ffmpeg, reuse_recording=False):
    if not reuse_recording:
        env = os.environ.copy()
        local_modules = ROOT / 'build/node_modules'
        if local_modules.exists():
            env['NODE_PATH'] = str(local_modules) + (os.pathsep + env['NODE_PATH'] if env.get('NODE_PATH') else '')
        subprocess.run(['node', str(ROOT / 'scripts/record_scope_video.cjs')], cwd=ROOT, env=env, check=True)
    capture = json.loads((CAPTURE / 'recording.json').read_text(encoding='utf-8'))
    digest = hashlib.sha256((ROOT / capture['source']).read_bytes()).hexdigest()
    if capture['sha256'] != digest:
        raise ValueError('Practice app changed after recording. Capture it again before encoding.')
    if capture['pageErrors'] or capture['networkRequests']:
        raise ValueError('Recording did not pass the offline app checks.')
    seconds = capture['secondsPerStep']
    scenes = capture['scenes']
    if len(scenes) != 5 or seconds != 13:
        raise ValueError('Update the chapter controls before changing the five 13-second chapters.')
    command = [str(ffmpeg), '-y', '-loglevel', 'error']
    for i in range(len(scenes)):
        command += ['-i', str(CAPTURE / f'step-{i+1}.webm')]
    # Normalize the captured clips without speeding up any learner actions.
    # Recorder stop overhead is trimmed; a last frame can pad a short clip.
    filters = [f'[{i}:v]fps=25,tpad=stop_mode=clone:stop_duration=1,trim=duration={seconds},setpts=PTS-STARTPTS[v{i}]' for i in range(len(scenes))]
    filters += [''.join(f'[v{i}]' for i in range(len(scenes))) + f'concat=n={len(scenes)}:v=1:a=0[out]']
    output = ROOT / 'guide/scope-walkthrough.mp4'
    pending = CAPTURE / 'scope-walkthrough.mp4'
    command += ['-filter_complex', ';'.join(filters), '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(pending)]
    subprocess.run(command, check=True)
    shutil.copyfile(pending, output)
    subprocess.run([str(ffmpeg), '-y', '-loglevel', 'error', '-ss', '2', '-i', str(output), '-frames:v', '1', str(ASSETS / 'scope-walkthrough.png')], check=True)

    def timestamp(value):
        return f'00:{int(value)//60:02d}:{value%60:06.3f}'
    cues = ['WEBVTT', '']
    for i, scene in enumerate(scenes):
        for half, instruction in enumerate(scene['captions']):
            start = i*seconds + half*seconds/2
            cues += [f'{timestamp(start)} --> {timestamp(start+seconds/2)}', f'Step {i+1}. {instruction}', '']
    (ASSETS / 'scope-walkthrough.vtt').write_text('\n'.join(cues), encoding='utf-8')
    capture['durationSeconds'] = seconds*len(scenes)
    capture['videoSha256'] = hashlib.sha256(output.read_bytes()).hexdigest()
    capture['captureMethod'] = 'Playwright screencast of the guide-launched practice lab; caption, pointer and focus overlays only.'
    (ASSETS / 'scope-walkthrough.json').write_text(json.dumps(capture, indent=2)+'\n', encoding='utf-8')
    print(f'Built actual practice-lab walkthrough ({seconds*len(scenes)} seconds, {output.stat().st_size:,} bytes).', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ffmpeg', type=Path)
    parser.add_argument('--reuse-recording', action='store_true')
    args = parser.parse_args()
    encoder = args.ffmpeg or shutil.which('ffmpeg')
    if not encoder:
        sys.path.insert(0, str(ROOT / 'build/video-tools'))
        import imageio_ffmpeg
        encoder = imageio_ffmpeg.get_ffmpeg_exe()
    render_assets(encoder, args.reuse_recording)

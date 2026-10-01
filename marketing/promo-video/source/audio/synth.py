"""Original music bed + UI sound effects for the دعوتي promo.

Everything here is synthesised from scratch (no samples, no third-party
audio), so the soundtrack carries no licensing questions.

Usage: python3 synth.py cues.json out.wav
cues.json = {"duration": 76.0, "bpm": 100, "sections": [{"name":"hook","start":0,"end":3}, ...],
             "sfx": [{"t": 1.2, "kind": "tap"}, ...]}
"""
import json
import sys

import numpy as np
from scipy import signal

SR = 48000
rng = np.random.default_rng(7)


# ---------------------------------------------------------------- helpers
def secs(n):
    return int(round(n * SR))


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def adsr(n, a=0.01, d=0.1, s=0.7, r=0.2, sus_len=None):
    a_n, d_n, r_n = secs(a), secs(d), secs(r)
    tot = a_n + d_n + r_n
    if tot > n and n > 0:  # short notes: shrink the envelope instead of truncating it (no clicks)
        k = n / tot
        a_n, d_n = int(a_n * k), int(d_n * k)
        r_n = max(1, n - a_n - d_n)
    sus_n = max(0, n - a_n - d_n - r_n) if sus_len is None else secs(sus_len)
    env = np.concatenate([
        np.linspace(0, 1, max(a_n, 1), endpoint=False),
        np.linspace(1, s, max(d_n, 1), endpoint=False),
        np.full(sus_n, s),
        np.linspace(s, 0, max(r_n, 1)),
    ])
    if len(env) < n:
        env = np.pad(env, (0, n - len(env)))
    return env[:n]


def lowpass(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR / 2 - 100) / (SR / 2), "low")
    return signal.lfilter(b, a, x)


def highpass(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def bandpass(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], "band")
    return signal.lfilter(b, a, x)


def add(buf, x, t, gain=1.0, pan=0.0):
    """Mix mono x into stereo buf at time t with constant-power pan (-1..1)."""
    i = secs(t)
    if i >= buf.shape[1]:
        return
    x = x[: buf.shape[1] - i]
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    buf[0, i:i + len(x)] += x * gain * l
    buf[1, i:i + len(x)] += x * gain * r


# ------------------------------------------------------------ instruments
def pluck(freq, dur, bright=0.5, body=True):
    """Karplus–Strong string: reads as oud/qanun when darkened."""
    n = secs(dur)
    p = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, p)
    buf = lowpass(buf, 1200 + 5000 * bright, 1)
    out = np.empty(n)
    decay = 0.996 - 0.004 * (freq / 1000)
    idx = 0
    for i in range(n):
        v = buf[idx]
        nxt = buf[(idx + 1) % p]
        buf[idx] = decay * 0.5 * (v + nxt)
        out[i] = v
        idx = (idx + 1) % p
    if body:  # a little wooden resonance
        out = out + 0.35 * bandpass(out, 180, 420) + 0.2 * bandpass(out, 900, 1600)
    out *= adsr(n, 0.002, 0.05, 0.85, min(0.25, dur * 0.4))
    return out / (np.max(np.abs(out)) + 1e-9)


def epiano(freq, dur, vel=0.8):
    """Soft Rhodes-like tone: sine partials + gentle tine."""
    n = secs(dur)
    t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * freq * t)
         + 0.35 * np.sin(2 * np.pi * 2 * freq * t) * np.exp(-t * 3)
         + 0.12 * np.sin(2 * np.pi * 3 * freq * t) * np.exp(-t * 6)
         + 0.05 * np.sin(2 * np.pi * 7.1 * freq * t) * np.exp(-t * 18))
    x *= np.exp(-t * 1.1) * adsr(n, 0.004, 0.2, 0.9, 0.3)
    trem = 1 + 0.06 * np.sin(2 * np.pi * 4.5 * t)
    return x * trem * vel


def pad(freqs, dur, cutoff=1400):
    n = secs(dur)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f in freqs:
        for det in (-0.12, 0.0, 0.11):
            ff = f * 2 ** (det / 12)
            ph = rng.uniform(0, 1)
            x += signal.sawtooth(2 * np.pi * (ff * t + ph)) * 0.33
    lfo = cutoff * (0.8 + 0.2 * np.sin(2 * np.pi * 0.15 * t))
    # time-varying cutoff via blockwise filtering
    out = np.zeros(n)
    blk = secs(0.05)
    zi = None
    for s in range(0, n, blk):
        fc = float(lfo[s])
        b, a = signal.butter(2, fc / (SR / 2), "low")
        if zi is None:
            zi = signal.lfilter_zi(b, a) * 0
        out[s:s + blk], zi = signal.lfilter(b, a, x[s:s + blk], zi=zi)
    out *= adsr(n, 0.12, 0.4, 0.85, 0.6)
    return out / (len(freqs) + 1e-9)


def sub(freq, dur):
    n = secs(dur)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) + 0.15 * np.sin(2 * np.pi * 2 * freq * t)
    return np.tanh(1.4 * x) * adsr(n, 0.01, 0.1, 0.8, 0.12)


def dum(vel=1.0):
    n = secs(0.45)
    t = np.arange(n) / SR
    f = 55 + 70 * np.exp(-t * 28)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    x += 0.15 * lowpass(rng.uniform(-1, 1, n), 900) * np.exp(-t * 60)
    return x * vel


def tek(vel=1.0):
    n = secs(0.12)
    t = np.arange(n) / SR
    x = bandpass(rng.uniform(-1, 1, n), 2500, 9000) * np.exp(-t * 55)
    x += 0.4 * np.sin(2 * np.pi * 620 * t) * np.exp(-t * 60)
    return x * vel * 0.7


def riq(vel=1.0):
    n = secs(0.18)
    t = np.arange(n) / SR
    x = highpass(rng.uniform(-1, 1, n), 6000) * np.exp(-t * 30)
    return x * vel * 0.35


def snap(vel=1.0):
    n = secs(0.2)
    t = np.arange(n) / SR
    x = bandpass(rng.uniform(-1, 1, n), 1200, 5000) * np.exp(-t * 45)
    return x * vel


# ------------------------------------------------------------------ sfx
def sfx(kind):
    """Every effect gets a 2 ms fade-in and 12 ms fade-out so none can click."""
    x = np.array(_sfx(kind), dtype=float)
    fi, fo = min(len(x), secs(0.002)), min(len(x), secs(0.012))
    x[:fi] *= np.linspace(0, 1, fi)
    x[len(x) - fo:] *= np.linspace(1, 0, fo)
    return x


def _sfx(kind):
    if kind == "tap":
        n = secs(0.08); t = np.arange(n) / SR
        return (np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 80) * 0.8
                + bandpass(rng.uniform(-1, 1, n), 2000, 7000) * np.exp(-t * 120) * 0.35)
    if kind == "pop":  # chat message arrives
        n = secs(0.16); t = np.arange(n) / SR
        f = 500 + 900 * (1 - np.exp(-t * 40))
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 26) * 0.7
    if kind == "buzz":  # phone vibrating
        n = secs(0.35); t = np.arange(n) / SR
        x = signal.square(2 * np.pi * 150 * t) * 0.2 + np.sin(2 * np.pi * 150 * t) * 0.4
        return lowpass(x, 600) * adsr(n, 0.01, 0.05, 0.9, 0.05)
    if kind == "whoosh":
        n = secs(0.6); t = np.arange(n) / SR
        x = rng.uniform(-1, 1, n)
        env = np.sin(np.pi * np.clip(t / 0.6, 0, 1)) ** 2
        out = np.zeros(n); blk = secs(0.02)
        for s in range(0, n, blk):
            fc = 400 + 5000 * (s / n)
            out[s:s + blk] = bandpass(x[s:s + blk], fc * 0.6, fc * 1.4, 1)
        return out * env * 0.8
    if kind == "paper":  # envelope opening
        n = secs(0.5); t = np.arange(n) / SR
        crackle = (rng.uniform(0, 1, n) > 0.985) * rng.uniform(-1, 1, n)
        x = bandpass(crackle * 3 + rng.uniform(-1, 1, n) * 0.25, 1500, 8000)
        return x * np.sin(np.pi * t / 0.5) * 0.6
    if kind == "chime":
        n = secs(2.2); t = np.arange(n) / SR
        x = np.zeros(n)
        for f, a, d in ((1318.5, 1, 2.2), (1760, 0.6, 2.8), (2637, 0.35, 4), (3520, 0.2, 5.5)):
            x += a * np.sin(2 * np.pi * f * t) * np.exp(-t * d)
        return x * 0.35
    if kind == "sparkle":
        n = secs(1.2); x = np.zeros(n)
        for k, m in enumerate((88, 91, 93, 95, 98, 100)):
            tone = epiano(midi_hz(m), 0.9, 0.25)
            i = secs(0.06 * k)
            x[i:i + len(tone)] += tone[: n - i]
        return x * 0.5
    if kind == "beep":  # scanner success
        n = secs(0.32); t = np.arange(n) / SR
        a = np.sin(2 * np.pi * 1760 * t) * (t < 0.12)
        b = np.sin(2 * np.pi * 2349.3 * t) * (t >= 0.14)
        return (a + b) * np.exp(-t * 6) * 0.45
    if kind == "success":
        n = secs(1.0); x = np.zeros(n)
        for k, m in enumerate((74, 78, 81)):
            tone = epiano(midi_hz(m), 0.8, 0.6)
            i = secs(0.08 * k)
            x[i:i + len(tone)] += tone[: n - i]
        return x * 0.6
    if kind == "impact":
        n = secs(1.6); t = np.arange(n) / SR
        f = 38 + 60 * np.exp(-t * 18)
        boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
        air = lowpass(rng.uniform(-1, 1, n), 2500) * np.exp(-t * 9) * 0.25
        return (boom + air) * 0.9
    if kind == "riser":
        n = secs(1.5); t = np.arange(n) / SR
        x = rng.uniform(-1, 1, n); out = np.zeros(n); blk = secs(0.02)
        for s in range(0, n, blk):
            fc = 300 + 7000 * (s / n) ** 2
            out[s:s + blk] = bandpass(x[s:s + blk], fc * 0.7, fc * 1.3, 1)
        return out * (t / 1.5) ** 1.5 * 0.5
    if kind == "tick":
        n = secs(0.04); t = np.arange(n) / SR
        return bandpass(rng.uniform(-1, 1, n), 3000, 9000) * np.exp(-t * 200) * 0.5
    if kind == "type":
        n = secs(0.03); t = np.arange(n) / SR
        return bandpass(rng.uniform(-1, 1, n), 2000, 8000) * np.exp(-t * 250) * 0.6
    if kind == "sweep":
        n = secs(1.0); t = np.arange(n) / SR
        return bandpass(rng.uniform(-1, 1, n), 3000, 7000) * np.sin(np.pi * t) * 0.25
    if kind == "dock":  # a question gets its answer: bright two-partial tick
        n = secs(0.5); t = np.arange(n) / SR
        x = (np.sin(2 * np.pi * 1760 * t) + 0.3 * np.sin(2 * np.pi * 3520 * t)) * np.exp(-t * 9) * 0.35
        c = sfx("tick"); x[:len(c)] += c * 1.2
        return x

    if kind == "pizz":
        return pluck(midi_hz(int(rng.choice([62, 65, 69, 74]))), 0.35, 0.7) * 0.6
    if kind in ("note1", "note2", "note3", "note4"):
        m = {"note1": 74, "note2": 78, "note3": 81, "note4": 86}[kind]
        return pluck(midi_hz(m), 1.2, 0.5) * 0.8
    if kind in ("motif", "motifFinal"):
        n = secs(3.5 if kind == "motifFinal" else 1.6); x = np.zeros(n)
        for k, m in enumerate((74, 78, 81, 86)):
            tone = pluck(midi_hz(m), 1.1, 0.5); i = secs(0.16 * k)
            x[i:i + len(tone)] += tone[: n - i] * 0.8
        if kind == "motifFinal":
            for m in (50, 57, 62, 66, 69, 74):
                tone = epiano(midi_hz(m), 3.2, 0.35); x[: len(tone)] += tone[:n]
        return x * 0.6
    if kind == "grace":
        x = np.zeros(secs(1.0)); a = pluck(midi_hz(81), 0.5, 0.5); b = pluck(midi_hz(83), 0.9, 0.5)
        x[: len(a)] += a * 0.5; x[secs(0.08): secs(0.08) + len(b)] += b[: len(x) - secs(0.08)] * 0.7
        return x * 0.6
    if kind == "phrase":
        n = secs(3.2); x = np.zeros(n)
        for k, m in enumerate((69, 74, 78, 76)):
            tone = epiano(midi_hz(m), 1.4, 0.5); i = secs(0.625 * k)
            x[i:i + len(tone)] += tone[: n - i]
        return x * 0.45
    if kind == "bloom":
        return pad([midi_hz(m) for m in (50, 57, 62, 66)], 2.4, 2200) * 1.2
    if kind == "cluster":
        n = secs(0.6); t = np.arange(n) / SR
        x = sum(np.sin(2 * np.pi * midi_hz(m) * t) for m in (62, 63, 64, 65, 68)) / 5
        return x * (t / 0.6) ** 2 * 0.5
    if kind == "heart":
        x = np.zeros(secs(0.6)); a = dum(1.0); b = dum(0.6)
        x[: len(a)] += a[: len(x)]; i = secs(0.17); x[i:i + len(b)] += b[: len(x) - i]
        body = lowpass(x, 300); harm = bandpass(np.tanh(5 * body), 120, 1200)  # audible on phone speakers
        return body * 0.7 + harm * 0.45
    if kind == "thump":
        n = secs(0.5); t = np.arange(n) / SR
        return (np.sin(2 * np.pi * (70 + 60 * np.exp(-t * 30)) * t) * np.exp(-t * 9) + bandpass(rng.uniform(-1, 1, n), 800, 3000) * np.exp(-t * 80) * 0.3) * 0.9
    if kind == "suck":
        n = secs(0.35); t = np.arange(n) / SR
        return highpass(rng.uniform(-1, 1, n), 3000) * (t / 0.35) ** 3 * 0.6
    if kind in ("fold", "drop"):
        n = secs(0.35); t = np.arange(n) / SR
        return (bandpass(rng.uniform(-1, 1, n), 400, 3000) * np.exp(-t * 18) * 0.5 + lowpass(rng.uniform(-1, 1, n), 200) * np.exp(-t * 25)) * 0.7
    if kind == "rustle":
        n = secs(0.45); t = np.arange(n) / SR
        return bandpass(rng.uniform(-1, 1, n), 2000, 8000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 9 * t))) * np.sin(np.pi * t / 0.45) * 0.35
    if kind == "scribble":
        n = secs(0.4); t = np.arange(n) / SR
        return bandpass(rng.uniform(-1, 1, n), 1800, 6000) * (0.3 + 0.7 * np.abs(np.sin(2 * np.pi * 14 * t))) * np.sin(np.pi * t / 0.4) * 0.35
    if kind == "murmur":
        n = secs(1.6); t = np.arange(n) / SR
        return bandpass(rng.uniform(-1, 1, n), 150, 700) * (0.6 + 0.4 * np.sin(2 * np.pi * 1.3 * t)) * np.sin(np.pi * t / 1.6) * 0.35
    if kind in ("swoosh", "slide", "flip", "plane", "sendwhoosh"):
        x = sfx("whoosh")
        L = {"swoosh": 0.35, "slide": 0.45, "flip": 0.3, "plane": 0.5, "sendwhoosh": 0.45}[kind]
        x = x[: secs(L)] * np.sin(np.pi * np.arange(secs(L)) / secs(L))
        return (lowpass(x, 3000) if kind == "slide" else x) * 0.7
    if kind == "highlight":
        n = secs(0.35); t = np.arange(n) / SR
        return bandpass(rng.uniform(-1, 1, n), 3000, 7000) * np.sin(np.pi * t / 0.35) * 0.25
    if kind in ("click", "clock"):
        return sfx("tick") * (1.3 if kind == "click" else 0.9)
    if kind == "paste":
        x = np.zeros(secs(0.2)); a = sfx("pop"); x[: len(a)] += a[: len(x)] * 0.7; c = sfx("tick"); x[: len(c)] += c
        return x
    if kind in ("blipA", "blipR"):
        n = secs(0.28); t = np.arange(n) / SR
        f1, f2 = (880, 660) if kind == "blipA" else (520, 390)
        return (np.sin(2 * np.pi * f1 * t) * (t < 0.12) + np.sin(2 * np.pi * f2 * t) * (t >= 0.13)) * np.exp(-t * 7) * 0.35
    if kind in ("ding", "bell", "glass"):
        n = secs(1.8); t = np.arange(n) / SR
        base = {"ding": 1568, "bell": 1318.5, "glass": 2637}[kind]
        x = sum(a * np.sin(2 * np.pi * base * r * t) * np.exp(-t * d) for r, a, d in ((1, 1, 2.5), (2.76, .4, 4), (5.4, .15, 6)))
        return x * 0.3
    if kind == "pulse":
        n = secs(0.5); t = np.arange(n) / SR
        return np.sin(2 * np.pi * 220 * t) * np.sin(np.pi * t / 0.5) ** 2 * 0.3
    if kind == "slot":
        x = np.zeros(secs(0.3)); c = sfx("tick"); x[: len(c)] += c * 1.4
        th = sfx("thump")[: secs(0.25)] * 0.4; x[secs(0.05): secs(0.05) + len(th)] += th[: len(x) - secs(0.05)]
        return x
    if kind == "hit":
        n = secs(2.4); x = np.zeros(n)
        imp = sfx("impact"); x[: len(imp)] += imp[:n] * 0.9
        for k in range(6):
            d = dum(1.0 - k * 0.1); i = secs(0.09 * k); x[i:i + len(d)] += d[: n - i] * 0.6
        for k, m in enumerate((69, 71, 73, 74, 76, 78, 81)):
            tone = pluck(midi_hz(m), 0.6, 0.6); i = secs(0.25 + 0.06 * k); x[i:i + len(tone)] += tone[: n - i] * 0.4
        return x
    raise ValueError(kind)


# ----------------------------------------------------------------- reverb
def reverb(x, seconds=2.4, mix=0.22, lp=6000):
    n = secs(seconds)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = rng.uniform(-1, 1, n) * np.exp(-t * (6.9 / seconds))
        ir = lowpass(ir, lp)
        ir[: secs(0.012)] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        out[ch] = signal.fftconvolve(x[ch], ir)[: x.shape[1]]
    return x * (1 - mix) + out * mix * 1.4


# ------------------------------------------------------------------- song
# D harmonic minor world: Dm | Bb | Gm | A  (A major = Hijaz colour)
CHORDS = {
    "Dm": [50, 53, 57, 62], "Bb": [46, 50, 53, 58], "Gm": [43, 50, 55, 58], "A": [45, 49, 52, 57],
    "F": [41, 48, 53, 57], "C": [48, 52, 55, 60],
}
PROG = ["Dm", "Bb", "Gm", "A"]
CHORDS.update({"D": [50, 54, 57, 62], "G": [43, 50, 55, 59], "Bm": [47, 50, 54, 59], "Am": [45, 48, 52, 57]})
PROG_MAJ = ["D", "A", "Bm", "G"]
MAJ_MOTIFS = [[74, None, 76, 78, 81, None, 78, 76], [73, 76, 81, None, 78, 76, 73, 69],
              [74, 76, 78, None, 81, 83, 81, 78], [79, 78, 76, None, 74, None, None, None]]
# Hijaz-flavoured motif (midi), 8th-note grid per bar; None = rest
MOTIF_A = [74, None, 73, 74, 76, None, 77, 76]
MOTIF_B = [74, 72, 70, 69, None, 70, 69, 67]
MOTIF_C = [69, 70, 73, 74, 76, 74, 73, 70]
MOTIF_D = [69, None, None, 67, 69, None, None, None]


def section_at(sections, t):
    for s in sections:
        if s["start"] <= t < s["end"]:
            return s
    return sections[-1]


FORCE_D = [(8.2, 10.2), (12.7, 15.2), (64.5, 65.2), (72.7, 78.5)]  # tonic under the reveal, motif, hit, ending
CUT = 7.9          # act-1 → silence
RESUME = 8.2       # silence → reveal


def chord_name(b, t):
    if t < 8.1:
        return PROG[b % 4]
    if any(a <= t < z for a, z in FORCE_D):
        return "D"
    return PROG_MAJ[b % 4]


def render(cfg):
    dur = cfg["duration"]
    bpm = cfg.get("bpm", 100)
    beat = 60 / bpm
    bar = beat * 4
    sections = cfg["sections"]
    shape = (2, secs(dur + 3))
    music, drums, fx = np.zeros(shape), np.zeros(shape), np.zeros(shape)
    music_pre, drums_pre, fx_pre = np.zeros(shape), np.zeros(shape), np.zeros(shape)  # everything started before CUT
    offset = cfg.get("musicOffset", 0.0)
    first = -int(np.ceil(offset / bar)) if offset > 0 else 0
    nbars = int((dur - offset) / bar) + 2

    def sec_at(t):
        return section_at(sections, t + 1e-4)

    def M(t):
        return music_pre if t < CUT else music

    def D(t):
        return drums_pre if t < CUT else drums

    for b in range(first, nbars):
        t0 = offset + b * bar
        t1 = t0 + bar
        if t1 <= 0 or t0 >= dur:
            continue
        # ---- pads + chord stabs, split only where the harmony/silence really changes
        cuts = [t0] + [x for x in (CUT, RESUME, 64.5) if t0 < x < t1] + [t1]
        for a_, b_ in zip(cuts[:-1], cuts[1:]):
            sec = sec_at(a_); name = sec["name"]; energy = sec.get("energy", 0.5)
            if name == "silence" or b_ <= 0:
                continue
            notes = CHORDS[chord_name(b, a_)]
            st = max(a_, 0.0)
            add(M(st), pad([midi_hz(m + (12 if m < 50 else 0)) for m in notes], (b_ - st) + 0.6, 1100 + 1600 * energy), st, 0.14 + 0.08 * energy)
            if name not in ("reveal", "filterdown") and energy >= 0.3:
                vel = 0.16 + 0.1 * energy
                hits = (0, 1.5, 2.5) if energy > 0.6 else (0, 2)
                for hb in hits:
                    th = t0 + hb * beat
                    if a_ <= th < b_ and th >= 0 and not (name == "outro" and th >= 74.0):
                        for m in notes[1:]:
                            add(M(th), epiano(midi_hz(m + 12), beat * (1.4 if energy > 0.6 else 2.2), vel), th, 0.5, pan=-0.2)
        # ---- per-event instruments, gated by the section at each event time
        for k8 in range(8):
            te = t0 + k8 * beat / 2
            if te < 0 or te >= dur:
                continue
            sec = sec_at(te); name = sec["name"]; energy = sec.get("energy", 0.5)
            if name in ("silence", "reveal", "filterdown"):
                continue
            if name == "outro" and te >= 74.0:
                continue
            major = te >= 8.1
            notes = CHORDS[chord_name(b, te)]
            on_beat = k8 % 2 == 0
            bpos = k8 / 2
            mb, db = M(te), D(te)
            # bass
            if energy >= 0.45 and bpos in (0, 1.5, 2, 3.5):
                ln = {0: 1.2, 1.5: 0.4, 2: 1.0, 3.5: 0.4}[bpos]
                root = notes[0] - 12 if notes[0] >= 48 else notes[0]
                add(mb, sub(midi_hz(root), beat * ln), te, 0.2)
            # plucked melody (an octave up so it does not mask the fundamentals)
            motif = None
            if energy >= 0.5 and name not in ("halftime", "intimate", "bloom", "outro") and not (12.7 <= te < 15.3):
                if major:
                    idx = (b + 2) % 4 if 52.7 <= te < 63.4 else b % 4
                    motif = MAJ_MOTIFS[idx]
                else:
                    motif = [MOTIF_A, MOTIF_B, MOTIF_C, MOTIF_D][b % 4]
                m = motif[k8]
                if m is not None:
                    add(mb, pluck(midi_hz(m), beat * 1.2, 0.55), te, 0.3, pan=0.25)
                    if name == "lift":
                        add(mb, pluck(midi_hz(m + 12), beat, 0.6), te, 0.22, pan=-0.25)
            elif energy >= 0.3 and k8 in (0, 6):
                m = (notes[-1] if k8 == 0 else notes[-2]) + (12 if name in ("halftime", "intimate", "bloom") else 0)
                add(mb, pluck(midi_hz(m), beat * 2, 0.25), te, 0.2, pan=0.3)
            # percussion
            if name == "halftime":
                if bpos == 0:
                    add(db, dum(0.7), te, 0.3)
                if bpos == 2:
                    add(db, snap(0.7), te, 0.18, pan=0.1)
                continue
            if name in ("intimate", "bloom", "outro"):
                continue
            if name == "lift":
                if bpos in (1, 3):
                    add(db, snap(1.0), te, 0.45, pan=-0.25); add(db, snap(0.8), te + 0.012, 0.4, pan=0.25)
                if bpos in (0, 0.5, 2, 2.5):
                    add(db, dum(0.8), te, 0.3)
            if energy >= 0.55:
                if bpos in (0, 2):
                    add(db, dum(0.9), te, 0.38)
                if bpos in (1, 1.5, 3):
                    add(db, tek(0.8), te, 0.45, pan=0.15)
                add(db, riq(0.5 + 0.3 * on_beat), te, 0.35 * energy, pan=-0.3)
                if b % 4 == 3 and bpos >= 3:  # riq fill into the next phrase
                    for dd in (0, 0.156):
                        add(db, riq(0.9), te + dd, 0.3 * energy)
                if name in ("lift", "peak") and bpos in (1, 3):
                    add(db, snap(0.9), te, 0.3, pan=0.2)
            elif energy >= 0.3 and not on_beat:
                add(db, snap(0.4), te, 0.07, pan=0.1)
    # sustained tonic under the end card
    add(music, sub(midi_hz(38), 3.0), 75.0, 0.22)

    for ev in cfg.get("sfx", []):
        if 0 <= ev["t"] < dur:
            add(fx_pre if ev["t"] < CUT else fx, sfx(ev["kind"]), ev["t"], ev.get("gain", 1.0), ev.get("pan", 0.0))

    mix = reverb(music, 1.8, 0.2, 9000) + reverb(drums, 1.2, 0.12) * 0.9
    pre = reverb(music_pre, 1.8, 0.2, 9000) + reverb(drums_pre, 1.2, 0.12) * 0.9
    fxr = reverb(fx, 1.4, 0.18)
    fpre = reverb(fx_pre, 1.4, 0.18)
    # hard gate at CUT: total silence until RESUME (8 ms ramp so nothing clicks)
    g = np.ones(shape[1]); c0 = secs(CUT); ramp = secs(0.008)
    g[c0:c0 + ramp] = np.linspace(1, 0, ramp); g[c0 + ramp:] = 0
    mix += pre * g; fxr += fpre * g
    r0 = secs(RESUME)
    for buf in (mix, fxr):
        buf[:, c0 + ramp:r0] = 0
        buf[:, r0:r0 + ramp] *= np.linspace(0, 1, ramp)
    # filtered dip before the door hit, crossfaded in/out
    for sec in sections:
        if sec["name"] == "filterdown":
            a, z = secs(sec["start"]), secs(sec["end"])
            w = np.zeros(shape[1]); rr = secs(0.05)
            w[a:a + rr] = np.linspace(0, 1, rr); w[a + rr:z - rr] = 1; w[z - rr:z] = np.linspace(1, 0, rr)
            for ch in range(2):
                lp = lowpass(mix[ch], 900) * 0.8
                mix[ch] = mix[ch] * (1 - w) + lp * w
        if sec["name"] == "lift":  # +2 dB for the payoff
            a, z = secs(sec["start"]), secs(sec["end"])
            w = np.ones(shape[1]); rr = secs(0.05); gdb = 10 ** (2 / 20)
            w[a:a + rr] = np.linspace(1, gdb, rr); w[a + rr:z - rr] = gdb; w[z - rr:z] = np.linspace(gdb, 1, rr)
            mix *= w
    fade_in = secs(cfg.get("fadeIn", 0.02))
    mix[:, :fade_in] *= np.linspace(0, 1, fade_in)
    end = secs(dur)
    tail = secs(cfg.get("fadeOut", 1.2))
    mix[:, end - tail:end] *= np.linspace(1, 0, tail)
    mix[:, end:] = 0
    env_ = np.convolve(np.abs(fxr).mean(0), np.ones(secs(0.08)) / secs(0.08), "same")
    duck = 1 - np.clip(env_ * 1.5, 0, 0.5)
    out = mix * duck * cfg.get("musicGain", 0.8) + fxr * cfg.get("sfxGain", 1.0)
    out = out[:, :end]
    for ch in range(2):  # clean low end, a little air, less boxiness
        y = highpass(out[ch], 40)
        y = y - 0.45 * lowpass(y, 140) + 0.25 * bandpass(y, 2500, 6000)
        y = y + 0.4 * highpass(y, 7000) - 0.2 * bandpass(y, 220, 450)
        out[ch] = y
    out = np.tanh(out * 1.2) / 1.2
    f = secs(0.05)
    out[:, -f:] *= np.linspace(1, 0, f)
    return out


def limit(x, ceiling=0.84):
    """Look-ahead brickwall-ish limiter: gain = min over a short window, smoothed."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    peak = np.max(np.abs(x), axis=0)
    g = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    g = minimum_filter1d(g, size=secs(0.012) * 2 + 1)
    g = uniform_filter1d(g, size=secs(0.012))
    g = minimum_filter1d(g, size=secs(0.004) * 2 + 1)
    return x * g


def true_peak(x):
    return max(np.abs(signal.resample_poly(x[ch], 4, 1)).max() for ch in range(x.shape[0]))


def loudnorm(x, target=-14.0, tp_db=-2.6):  # headroom for AAC overshoot
    import pyloudnorm as pyln
    meter = pyln.Meter(SR)
    ceiling = 0.84
    for _ in range(6):  # gain → limit → re-measure; tighten the ceiling until the true peak fits
        lufs = meter.integrated_loudness(x.T)
        x = limit(x * 10 ** ((target - lufs) / 20), ceiling)
        tp = true_peak(x)
        if tp > 10 ** (tp_db / 20):
            ceiling *= 10 ** (tp_db / 20) / tp
    x = np.clip(x, -ceiling, ceiling)
    tp = true_peak(x)
    if tp > 10 ** (tp_db / 20):
        x = x * 10 ** (tp_db / 20) / tp
    return x


def write_wav(path, x):
    from scipy.io import wavfile
    wavfile.write(path, SR, (np.clip(x, -1, 1).T * 32767).astype(np.int16))


if __name__ == "__main__":
    cfg = json.load(open(sys.argv[1]))
    out = loudnorm(render(cfg), cfg.get("lufs", -14.0))
    write_wav(sys.argv[2], out)
    try:
        import pyloudnorm as pyln
        print("LUFS", round(pyln.Meter(SR).integrated_loudness(out.T), 2), "peak", round(float(np.max(np.abs(out))), 3))
    except Exception:
        pass

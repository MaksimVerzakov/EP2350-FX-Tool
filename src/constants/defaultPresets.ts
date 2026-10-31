import { PackConfig } from '../types/config';
import { parseConfigJson } from '../utils/parser';

import brokenRadioRaw from '../../packs/ep-2350_preset_pack-broken_radio/config.json?raw';
import dubPackRaw from '../../packs/ep-2350_preset_pack-dub/config.json?raw';
import mysteriousPackRaw from '../../packs/ep-2350_preset_pack-mysterious/config.json?raw';

export interface OfficialPackPreset {
  id: string;
  name: string;
  subtitle: string;
  rawJson: string;
  pack: PackConfig;
}

const buildPack = (id: string, subtitle: string, rawJson: string): OfficialPackPreset => {
  const parsed = parseConfigJson(rawJson);
  if (!parsed.pack) {
    throw new Error(`Failed to parse official pack ${id}: ${parsed.error}`);
  }
  return {
    id,
    name: parsed.pack.name,
    subtitle,
    rawJson,
    pack: parsed.pack
  };
};

export const OFFICIAL_TE_PACKS: OfficialPackPreset[] = [
  buildPack(
    'broken_radio',
    'WALKIE TALKIE · AM TUNER · CRYPTIC · LOSING SIGNAL',
    brokenRadioRaw
  ),
  buildPack(
    'dub',
    'SPACE ECHO · KING TUBBY HPF · SPRING TANK · RIDDIM WARP',
    dubPackRaw
  ),
  buildPack(
    'mysterious',
    'MANUAL PITCHER · DEEP TRAP · HYPER POP · ALIEN TUNE',
    mysteriousPackRaw
  )
];

export const INITIAL_PACK: PackConfig = OFFICIAL_TE_PACKS[0].pack;
export const DEFAULT_PRESETS = INITIAL_PACK.presets;

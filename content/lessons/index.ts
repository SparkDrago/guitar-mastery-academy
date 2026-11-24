import type { Lesson } from '@gma/learning';
import { LEVEL_0 } from './level00';
import { LEVEL_1 } from './level01';
import { LEVEL_2 } from './level02';
import { LEVEL_3 } from './level03';
import { LEVEL_4 } from './level04';
import { LEVEL_5 } from './level05';
import { LEVEL_6 } from './level06';
import { LEVEL_7 } from './level07';
import { LEVEL_8 } from './level08';
import { LEVEL_9 } from './level09';
import { LEVEL_10, LEVEL_11, LEVEL_12 } from './level10-12';

/** All lessons in curriculum order. */
export const LESSONS: Lesson[] = [
  ...LEVEL_0, ...LEVEL_1, ...LEVEL_2, ...LEVEL_3, ...LEVEL_4, ...LEVEL_5, ...LEVEL_6,
  ...LEVEL_7, ...LEVEL_8, ...LEVEL_9, ...LEVEL_10, ...LEVEL_11, ...LEVEL_12,
];

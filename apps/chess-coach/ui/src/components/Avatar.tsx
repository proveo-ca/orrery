import type { Component } from 'solid-js';
import { coachEmotion } from '../store/coachState';
import './Avatar.css';

export const Avatar: Component = () => {
  return (
    <div class={"cat " + coachEmotion()}>
      <div class="ear ear--left"></div>
      <div class="ear ear--right"></div>
      <div class="face">
        <div class="eye eye--left">
          <div class="eye-pupil"></div>
        </div>
        <div class="eye eye--right">
          <div class="eye-pupil"></div>
        </div>
        <div class="muzzle"></div>
      </div>
      <div class="zzz-container">
        <div class="z z-1">Z</div>
        <div class="z z-2">Z</div>
        <div class="z z-3">Z</div>
      </div>
    </div>
  );
};

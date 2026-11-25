import React from 'react';
import {Text as NativeText, type TextProps} from 'react-native';

export default function GuideText({style, ...props}: TextProps) {
  return (
    <NativeText
      {...props}
      style={[style, {fontWeight: 'normal', fontFamily: 'MSGothic'}]}
    />
  );
}

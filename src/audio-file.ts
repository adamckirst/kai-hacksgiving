export function audioFileError(files:File[]) {
 if(files.length!==1 || files.some(f=>f.size>10000000))return 'Choose one recording, up to 10 MB.';
 if(files.some(f=>!f.size || !/\.(m4a|opus|ogg|mp3|wav)$/i.test(f.name)))return 'Choose an audio file: M4A, OPUS, OGG, MP3 or WAV.';
 return '';
}

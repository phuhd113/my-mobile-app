import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

export default function VideoViewer({ placeholderVideoSource, selectedVideo }) {
    const videoSource = selectedVideo ? { uri: selectedVideo } : placeholderVideoSource;
    return (
        <Video source={videoSource} style={styles.video} useNativeControls
            resizeMode= {ResizeMode.CONTAIN}
            isLooping = {false}/>
    );
}

const styles = StyleSheet.create({
    video: {
        width: 400,
        height: 440,
        //borderRadius: 18,
    },
});

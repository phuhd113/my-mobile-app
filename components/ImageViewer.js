import { StyleSheet, Image } from 'react-native';

export default function ImageViewer({ placeholderImageSource, selectedImage }) {
    const imageSource = selectedImage  ? { uri: selectedImage } : placeholderImageSource;
  return (
    <Image source={imageSource} style={styles.image} />
  );
}

const styles = StyleSheet.create({
  image: {
    width: 380,
    height: 500,
    //borderRadius: 18,
  },
});

# GeodesicWalker
Try the online demo [here](https://markjgillespie.com/Demos/GeodesicWalker/html/)!

![Spot the cow walking along spot the cow.](images/octo-walk.gif)
A simple project to visualize a mesh walking along geodesics on itself. Powered by [geometry-central](http://geometry-central.net/) and [Polyscope](http://polyscope.run/). Javascript visualization performed by [geoptic.js](http://github.com/MarkGillespie/geoptic.js).

To compile the code, use
``` bash
mkdir build
cd build
cmake -DCMAKE_BUILD_TYPE=Release ..
```

## Javascript Version
This can also be compiled to Javascript via [Emscripten](https://emscripten.org/docs/getting_started/downloads.html).

Once you have Emscripten installed, then building this code is just like building an ordinary `geometry-central` project. Run the following commands from the `build` directory.
``` bash
emcmake cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_C_COMPILER=emcc -DCMAKE_CXX_COMPILER=em++ -DEMSCRIPTEN=True ..
emmake make -j7
```
This creates two "binaries", `bin/embind.js` and `bin/embind.wasm`. Then, you should copy these files into the `html` directory.

Because of some browser stuff, these `embind` files need to be served from a server - the page doesn't work if you just open the file locally.

Note that I had to include Eigen as an explicit dependency. Emscripten didn't like geometry-central's fancy on-the-fly Eigen downloader. But if you just include Eigen as a dependency everything works fine.

## Switching back from Javascript to local binaries
If you want to compile the ordinary command line version after building the javascript version, you have to tell CMake to use your C compiler again
``` bash
cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_C_COMPILER=gcc -DCMAKE_CXX_COMPILER=g++ -DEMSCRIPTEN=False ..
make -j7
```

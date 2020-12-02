#!/bin/bash

#  common data
source configuration

pushd $QUARTO_PACKAGE_DIR

rm -rf $QUARTO_DIST_DIR

if [ ! -d "$QUARTO_DIST_DIR" ]; then
	mkdir -p $QUARTO_DIST_DIR
fi
pushd $QUARTO_DIST_DIR

## Share Directory
if [ ! -d "$QUARTO_SHARE_DIR" ]; then
	mkdir -p "$QUARTO_SHARE_DIR"
fi
cp -a ../../src/resources/* $QUARTO_SHARE_DIR/

## Binary Directory
if [ ! -d "$QUARTO_BIN_DIR" ]; then
	mkdir -p "$QUARTO_BIN_DIR"
fi

# Move the quarto shell script into place
cp ../scripts/macos/quarto $QUARTO_BIN_DIR/quarto

# setup local symlink
ln -fs $(realpath $QUARTO_BIN_DIR/quarto) /usr/local/bin/quarto

popd
popd
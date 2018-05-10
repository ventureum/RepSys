#!/bin/bash
rm -rf build/
truffle compile
truffle migrate --reset
truffle test

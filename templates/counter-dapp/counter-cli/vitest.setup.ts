import protobuf from 'protobufjs';
import Long from 'long';

protobuf.util.Long = Long;
protobuf.configure();

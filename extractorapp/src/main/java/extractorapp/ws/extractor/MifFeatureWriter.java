/**
 * 
 */
package extractorapp.ws.extractor;

import java.io.File;

import org.geotools.data.simple.SimpleFeatureCollection;
import org.opengis.feature.simple.SimpleFeatureType;
import org.opengis.util.ProgressListener;

/**
 * This class implements the MIF-format writing strategy
 * 
 * @author Mauricio Pazos
 *
 */
class MifFeatureWriter extends FileFeatureWriter {

	/**
	 * new instance of MifFeatureWriter
	 * @param progressListerner
	 * @param schema
	 * @param basedir
	 * @param features
	 */
	public MifFeatureWriter(ProgressListener progressListerner,
			SimpleFeatureType schema,
			File basedir,
			SimpleFeatureCollection features) {
		
		super(progressListerner, schema, basedir, features);
	}

	/**
	 * Creates a {@link MifDatastoreFactory}
	 * 
	 * @return a {@link MifDatastoreFactory}
	 */
	@Override
	protected DatastoreFactory getDatastoreFactory(){
		return new MifDatastoreFactory();
	}
	
	

}
